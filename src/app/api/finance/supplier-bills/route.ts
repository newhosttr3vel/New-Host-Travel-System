import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { calculateSupplierBillLines, calculateInvoiceTotal } from "@/lib/invoice-calculations";
import { amountToCents, centsToAmount, normalizeJournalLines, rateToUnits, JournalValidationError } from "@/lib/finance-journal";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T12:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const schema = z.object({
  supplierId: z.string().trim().min(1).max(80),
  reservationId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  billDate: dateOnly,
  dueDate: z.union([dateOnly, z.literal("")]).optional(),
  supplierReference: z.string().trim().max(120).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  exchangeRate: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/),
  taxAmount: money.default("0.00"),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().uuid(),
  lines: z.array(z.object({
    description: z.string().trim().min(2).max(240),
    quantity: money,
    unitPrice: money,
    expenseAccountId: z.string().trim().min(1).max(80)
  })).min(1).max(100)
}).superRefine((value, ctx) => {
  if (value.dueDate && value.dueDate !== "" && value.dueDate < value.billDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dueDate"], message: "Due date cannot be earlier than bill date." });
  }
});
const include = {
  supplier: { select: { id: true, name: true, email: true, phone: true } },
  reservation: { select: { id: true, reference: true } },
  journalEntry: { select: { id: true, reference: true } },
  lines: { include: { expenseAccount: { select: { id: true, code: true, name: true, nameEn: true } } }, orderBy: { createdAt: "asc" as const } },
  payments: { include: { account: { select: { id: true, code: true, name: true, nameEn: true } }, journalEntry: { select: { reference: true } } }, orderBy: { paymentDate: "desc" as const } }
} as const;
function dayAtNoon(value: string) { return new Date(value + "T12:00:00.000Z"); }
function isPrismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function publicBill(bill: any) {
  return {
    ...bill,
    billDate: bill.billDate.toISOString(),
    dueDate: bill.dueDate?.toISOString() ?? null,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
    exchangeRate: bill.exchangeRate.toString(),
    subtotal: bill.subtotal.toString(),
    taxAmount: bill.taxAmount.toString(),
    total: bill.total.toString(),
    paidAmount: bill.paidAmount.toString(),
    outstandingAmount: centsToAmount(amountToCents(bill.total.toString()) - amountToCents(bill.paidAmount.toString())),
    lines: bill.lines.map((line: any) => ({
      ...line, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), amount: line.amount.toString()
    })),
    payments: bill.payments.map((payment: any) => ({
      ...payment, paymentDate: payment.paymentDate.toISOString(), amount: payment.amount.toString(),
      exchangeRate: payment.exchangeRate.toString(), createdAt: payment.createdAt.toISOString(),
      journalReference: payment.journalEntry.reference
    }))
  };
}

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "finance:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const p = Number(url.searchParams.get("page") ?? "1");
  const s = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(p) && p > 0 ? Math.min(p, 100000) : 1;
  const pageSize = Number.isInteger(s) && s > 0 ? Math.min(s, 100) : 25;
  const status = url.searchParams.get("status");
  const where = {
    tenantId: access.membership.tenantId,
    ...(status && ["ISSUED", "PARTIALLY_PAID", "PAID", "VOID"].includes(status)
      ? { status: status as "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.supplierBill.findMany({ where, include, orderBy: [{ billDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.supplierBill.count({ where })
  ]);
  return Response.json({
    baseCurrency: access.membership.tenant.defaultCurrency,
    items: items.map(publicBill),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "finance:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const tenantId = access.membership.tenantId;
  const reservationId = input.reservationId || undefined;
  const dueDate = input.dueDate && input.dueDate !== "" ? input.dueDate : undefined;

  let calculated: ReturnType<typeof calculateSupplierBillLines>;
  let totals: ReturnType<typeof calculateInvoiceTotal>;
  try {
    calculated = calculateSupplierBillLines(input.lines);
    totals = calculateInvoiceTotal(calculated.subtotal, input.taxAmount);
    rateToUnits(input.exchangeRate);
  } catch (error) {
    if (error instanceof JournalValidationError) return Response.json({ error: "INVALID_BILL_AMOUNT", message: error.message }, { status: 400 });
    throw error;
  }
  const canonical = {
    supplierId: input.supplierId, reservationId: reservationId ?? null, billDate: input.billDate, dueDate: dueDate ?? null,
    supplierReference: input.supplierReference?.trim() ?? "", currency: input.currency, exchangeRate: input.exchangeRate,
    subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total, notes: input.notes?.trim() ?? "",
    lines: calculated.lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount, expenseAccountId: line.expenseAccountId }))
  };
  const requestHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const prior = await tx.supplierBill.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey }, include });
      if (prior) {
        if (prior.requestHash !== requestHash) return { error: "IDEMPOTENCY_KEY_REUSED" as const };
        return { item: prior, replay: true as const };
      }
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId, archivedAt: null }, select: { id: true, name: true } });
      if (!supplier) return { error: "SUPPLIER_NOT_FOUND" as const };
      if (reservationId) {
        const reservation = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, archivedAt: null }, select: { id: true, supplierId: true } });
        if (!reservation || (reservation.supplierId && reservation.supplierId !== supplier.id)) return { error: "RESERVATION_NOT_FOUND" as const };
      }
      if (input.currency === access.membership.tenant.defaultCurrency && rateToUnits(input.exchangeRate) !== 100_000_000n) {
        return { error: "BASE_CURRENCY_RATE_MUST_BE_ONE" as const };
      }
      const payable = await tx.ledgerAccount.findFirst({ where: { tenantId, code: "2000", type: "LIABILITY", isActive: true }, select: { id: true } });
      if (!payable) return { error: "PAYABLE_ACCOUNT_MISSING" as const };
      const expenseIds = [...new Set(calculated.lines.map((line) => line.expenseAccountId))];
      const expenseAccounts = await tx.ledgerAccount.findMany({ where: { tenantId, id: { in: expenseIds }, type: "EXPENSE", isActive: true }, select: { id: true } });
      if (expenseAccounts.length !== expenseIds.length) return { error: "EXPENSE_ACCOUNT_INVALID" as const };
      let vatAccount: { id: string } | null = null;
      if (amountToCents(totals.taxAmount) > 0n) {
        vatAccount = await tx.ledgerAccount.findFirst({ where: { tenantId, code: "1300", type: "ASSET", isActive: true }, select: { id: true } });
        if (!vatAccount) return { error: "INPUT_VAT_ACCOUNT_MISSING" as const };
      }
      const billDate = dayAtNoon(input.billDate);
      const reference = "BILL-" + input.billDate.replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
      const rawLines = [
        ...calculated.lines.map((line) => ({ accountId: line.expenseAccountId, memo: line.description, debit: line.amount, credit: "0.00" })),
        ...(vatAccount ? [{ accountId: vatAccount.id, memo: "Recoverable VAT", debit: totals.taxAmount, credit: "0.00" }] : []),
        { accountId: payable.id, memo: "Accounts payable - " + reference, debit: "0.00", credit: totals.total }
      ];
      const journalLines = normalizeJournalLines(rawLines, input.exchangeRate);
      const journal = await tx.journalEntry.create({ data: {
        tenantId, reference: "J-" + reference, entryDate: billDate, description: "Supplier bill " + reference + " - " + supplier.name,
        currency: input.currency, exchangeRate: journalLines.exchangeRate, status: "POSTED", sourceType: "SUPPLIER_BILL",
        idempotencyKey: "supplier-bill:" + input.idempotencyKey, requestHash, createdById: access.session.user.id
      } });
      await tx.journalLine.createMany({ data: journalLines.lines.map((line) => ({
        tenantId, journalEntryId: journal.id, accountId: line.accountId, memo: line.memo,
        debit: line.debit, credit: line.credit, baseDebit: line.baseDebit, baseCredit: line.baseCredit
      })) });
      const bill = await tx.supplierBill.create({ data: {
        tenantId, supplierId: supplier.id, reservationId: reservationId ?? null, journalEntryId: journal.id,
        reference, supplierReference: input.supplierReference?.trim() || null, billDate,
        dueDate: dueDate ? dayAtNoon(dueDate) : null, status: "ISSUED", currency: input.currency,
        exchangeRate: journalLines.exchangeRate, subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total,
        paidAmount: "0.00", notes: input.notes?.trim() || null, idempotencyKey: input.idempotencyKey,
        requestHash, createdById: access.session.user.id
      } });
      await tx.supplierBillLine.createMany({ data: calculated.lines.map((line) => ({
        tenantId, supplierBillId: bill.id, expenseAccountId: line.expenseAccountId, description: line.description,
        quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount
      })) });
      const complete = await tx.supplierBill.findUniqueOrThrow({ where: { id: bill.id }, include });
      await tx.auditEvent.create({ data: {
        tenantId, userId: access.session.user.id, action: "SUPPLIER_BILL_ISSUED", entityType: "SupplierBill", entityId: bill.id,
        metadata: { reference, supplierId: supplier.id, total: totals.total, currency: input.currency, journalReference: journal.reference }
      } });
      return { item: complete, replay: false as const };
    });
    if ("error" in outcome) {
      const messages: Record<string, string> = {
        IDEMPOTENCY_KEY_REUSED: "Idempotency key used for different bill data.",
        SUPPLIER_NOT_FOUND: "Supplier not found or archived in this company.",
        RESERVATION_NOT_FOUND: "Reservation not found or linked to another supplier.",
        BASE_CURRENCY_RATE_MUST_BE_ONE: "Base currency exchange rate must be 1.",
        PAYABLE_ACCOUNT_MISSING: "Default accounts payable account 2000 is missing or inactive.",
        EXPENSE_ACCOUNT_INVALID: "Each expense account must be active and belong to this company.",
        INPUT_VAT_ACCOUNT_MISSING: "Recoverable VAT account 1300 is missing or inactive."
      };
      return Response.json({ error: outcome.error, message: messages[outcome.error] ?? "Bill could not be posted." }, { status: outcome.error === "IDEMPOTENCY_KEY_REUSED" ? 409 : 400 });
    }
    return Response.json({ item: publicBill(outcome.item), replay: outcome.replay }, { status: outcome.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof JournalValidationError) return Response.json({ error: "INVALID_BILL_AMOUNT", message: error.message }, { status: 400 });
    if (isPrismaCode(error, "P2002")) {
      const prior = await prisma.supplierBill.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey }, include });
      if (prior && prior.requestHash === requestHash) return Response.json({ item: publicBill(prior), replay: true }, { status: 200 });
      return Response.json({ error: "BILL_CONFLICT" }, { status: 409 });
    }
    throw error;
  }
}
