import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { calculateInvoiceLines, calculateInvoiceTotal } from "@/lib/invoice-calculations";
import { amountToCents, centsToAmount, normalizeJournalLines, rateToUnits, JournalValidationError } from "@/lib/finance-journal";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T12:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const invoiceSchema = z.object({
  customerId: z.string().trim().min(1).max(80),
  reservationId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  issueDate: dateOnly,
  dueDate: z.union([dateOnly, z.literal("")]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  exchangeRate: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/),
  taxAmount: money.default("0.00"),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().uuid(),
  lines: z.array(z.object({
    description: z.string().trim().min(2).max(240),
    quantity: money,
    unitPrice: money,
    revenueAccountId: z.string().trim().min(1).max(80)
  })).min(1).max(100)
}).superRefine((value, context) => {
  if (value.dueDate && value.dueDate !== "" && value.dueDate < value.issueDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dueDate"], message: "Due date cannot be earlier than issue date." });
  }
});

type DecimalValue = { toString(): string };
type InvoiceRecord = {
  id: string;
  reference: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  currency: string;
  exchangeRate: DecimalValue;
  subtotal: DecimalValue;
  taxAmount: DecimalValue;
  total: DecimalValue;
  paidAmount: DecimalValue;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  reservation: { id: string; reference: string } | null;
  journalEntry: { id: string; reference: string };
  lines: Array<{
    id: string;
    description: string;
    quantity: DecimalValue;
    unitPrice: DecimalValue;
    amount: DecimalValue;
    revenueAccount: { id: string; code: string; name: string; nameEn: string };
  }>;
  payments: Array<{
    id: string;
    receiptNumber: string;
    paymentDate: Date;
    method: string;
    amount: DecimalValue;
    currency: string;
    reference: string | null;
    notes: string | null;
    account: { id: string; code: string; name: string; nameEn: string };
    journalEntry: { reference: string };
  }>;
};

const invoiceInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  reservation: { select: { id: true, reference: true } },
  journalEntry: { select: { id: true, reference: true } },
  lines: {
    include: { revenueAccount: { select: { id: true, code: true, name: true, nameEn: true } } },
    orderBy: { createdAt: "asc" as const }
  },
  payments: {
    include: {
      account: { select: { id: true, code: true, name: true, nameEn: true } },
      journalEntry: { select: { reference: true } }
    },
    orderBy: { paymentDate: "desc" as const }
  }
} as const;

function publicInvoice(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    reference: invoice.reference,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    status: invoice.status,
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate.toString(),
    subtotal: invoice.subtotal.toString(),
    taxAmount: invoice.taxAmount.toString(),
    total: invoice.total.toString(),
    paidAmount: invoice.paidAmount.toString(),
    outstandingAmount: centsToAmount(amountToCents(invoice.total.toString()) - amountToCents(invoice.paidAmount.toString())),
    notes: invoice.notes,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    customer: invoice.customer,
    reservation: invoice.reservation,
    journalEntry: invoice.journalEntry,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      amount: line.amount.toString(),
      revenueAccount: line.revenueAccount
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate.toISOString(),
      method: payment.method,
      amount: payment.amount.toString(),
      currency: payment.currency,
      reference: payment.reference,
      notes: payment.notes,
      account: payment.account,
      journalReference: payment.journalEntry.reference
    }))
  };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function dayAtNoon(value: string): Date {
  return new Date(value + "T12:00:00.000Z");
}

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "finance:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const requestedSize = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = Number.isInteger(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 100) : 25;
  const status = url.searchParams.get("status");
  const where = {
    tenantId: access.membership.tenantId,
    ...(status && ["ISSUED", "PARTIALLY_PAID", "PAID", "VOID"].includes(status) ? { status: status as "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.invoice.count({ where })
  ]);
  return Response.json({
    baseCurrency: access.membership.tenant.defaultCurrency,
    items: items.map((item) => publicInvoice(item as unknown as InvoiceRecord)),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "finance:write");
  if (!access.ok) return access.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const tenantId = access.membership.tenantId;
  const reservationId = input.reservationId || undefined;
  const dueDate = input.dueDate && input.dueDate !== "" ? input.dueDate : undefined;
  let calculated: ReturnType<typeof calculateInvoiceLines>;
  let totals: ReturnType<typeof calculateInvoiceTotal>;
  try {
    calculated = calculateInvoiceLines(input.lines);
    totals = calculateInvoiceTotal(calculated.subtotal, input.taxAmount);
    rateToUnits(input.exchangeRate);
  } catch (error) {
    if (error instanceof JournalValidationError) {
      return Response.json({ error: "INVALID_INVOICE_AMOUNT", message: error.message }, { status: 400 });
    }
    throw error;
  }

  const canonicalPayload = {
    customerId: input.customerId,
    reservationId: reservationId ?? null,
    issueDate: input.issueDate,
    dueDate: dueDate ?? null,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    notes: input.notes?.trim() ?? "",
    lines: calculated.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      revenueAccountId: line.revenueAccountId
    }))
  };
  const requestHash = createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
  const include = invoiceInclude;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const previous = await tx.invoice.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey },
        include
      });
      if (previous) {
        if (previous.requestHash !== requestHash) return { error: "IDEMPOTENCY_KEY_REUSED" as const };
        return { item: previous, replay: true as const };
      }

      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, tenantId, archivedAt: null },
        select: { id: true, name: true }
      });
      if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };

      if (reservationId) {
        const reservation = await tx.reservation.findFirst({
          where: { id: reservationId, tenantId, customerId: customer.id, archivedAt: null },
          select: { id: true }
        });
        if (!reservation) return { error: "RESERVATION_NOT_FOUND" as const };
      }

      if (input.currency === access.membership.tenant.defaultCurrency && rateToUnits(input.exchangeRate) !== 100_000_000n) {
        return { error: "BASE_CURRENCY_RATE_MUST_BE_ONE" as const };
      }
      const exchangeRate = input.exchangeRate;
      const receivable = await tx.ledgerAccount.findFirst({
        where: { tenantId, code: "1100", type: "ASSET", isActive: true },
        select: { id: true }
      });
      if (!receivable) return { error: "RECEIVABLE_ACCOUNT_MISSING" as const };

      const revenueAccountIds = [...new Set(calculated.lines.map((line) => line.revenueAccountId))];
      const revenueAccounts = await tx.ledgerAccount.findMany({
        where: { tenantId, id: { in: revenueAccountIds }, isActive: true, type: "REVENUE" },
        select: { id: true }
      });
      if (revenueAccounts.length !== revenueAccountIds.length) return { error: "REVENUE_ACCOUNT_INVALID" as const };

      let taxAccount: { id: string } | null = null;
      if (amountToCents(totals.taxAmount) > 0n) {
        taxAccount = await tx.ledgerAccount.findFirst({
          where: { tenantId, code: "2200", type: "LIABILITY", isActive: true },
          select: { id: true }
        });
        if (!taxAccount) return { error: "VAT_ACCOUNT_MISSING" as const };
      }

      const date = dayAtNoon(input.issueDate);
      const reference = "INV-" + input.issueDate.replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
      const rawLines = [
        { accountId: receivable.id, memo: "Accounts receivable - " + reference, debit: totals.total, credit: "0.00" },
        ...calculated.lines.map((line) => ({
          accountId: line.revenueAccountId, memo: line.description, debit: "0.00", credit: line.amount
        })),
        ...(taxAccount ? [{ accountId: taxAccount.id, memo: "VAT payable", debit: "0.00", credit: totals.taxAmount }] : [])
      ];
      const normalized = normalizeJournalLines(rawLines, exchangeRate);

      const journal = await tx.journalEntry.create({
        data: {
          tenantId,
          reference: "J-" + reference,
          entryDate: date,
          description: "Invoice " + reference + " - " + customer.name,
          currency: input.currency,
          exchangeRate: normalized.exchangeRate,
          status: "POSTED",
          sourceType: "INVOICE",
          idempotencyKey: "invoice:" + input.idempotencyKey,
          requestHash,
          createdById: access.session.user.id
        }
      });
      await tx.journalLine.createMany({
        data: normalized.lines.map((line) => ({
          tenantId, journalEntryId: journal.id, accountId: line.accountId, memo: line.memo,
          debit: line.debit, credit: line.credit, baseDebit: line.baseDebit, baseCredit: line.baseCredit
        }))
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId: customer.id,
          reservationId: reservationId ?? null,
          journalEntryId: journal.id,
          reference,
          issueDate: date,
          dueDate: dueDate ? dayAtNoon(dueDate) : null,
          status: "ISSUED",
          currency: input.currency,
          exchangeRate: normalized.exchangeRate,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          paidAmount: "0.00",
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          createdById: access.session.user.id
        }
      });
      await tx.invoiceLine.createMany({
        data: calculated.lines.map((line) => ({
          tenantId,
          invoiceId: invoice.id,
          revenueAccountId: line.revenueAccountId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount
        }))
      });
      const completeInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include });
      await tx.auditEvent.create({
        data: {
          tenantId, userId: access.session.user.id, action: "INVOICE_ISSUED",
          entityType: "Invoice", entityId: completeInvoice.id,
          metadata: { reference, customerId: customer.id, total: totals.total, currency: input.currency, journalReference: journal.reference }
        }
      });
      return { item: completeInvoice, replay: false as const };
    });

    if ("error" in outcome) {
      const messages: Record<string, string> = {
        IDEMPOTENCY_KEY_REUSED: "Idempotency key is already used for different invoice data.",
        CUSTOMER_NOT_FOUND: "Customer not found in this company.",
        RESERVATION_NOT_FOUND: "Reservation not found for this customer.",
        BASE_CURRENCY_RATE_MUST_BE_ONE: "The base currency exchange rate must be 1.",
        RECEIVABLE_ACCOUNT_MISSING: "Default receivable account 1100 is missing or inactive.",
        REVENUE_ACCOUNT_INVALID: "Every selected revenue account must be active and belong to this company.",
        VAT_ACCOUNT_MISSING: "Default VAT payable account 2200 is missing or inactive."
      };
      return Response.json({ error: outcome.error, message: messages[outcome.error ?? "UNKNOWN_ERROR"] }, { status: outcome.error === "IDEMPOTENCY_KEY_REUSED" ? 409 : 400 });
    }
    return Response.json({ item: publicInvoice(outcome.item as unknown as InvoiceRecord), replay: outcome.replay }, { status: outcome.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof JournalValidationError) {
      return Response.json({ error: "INVALID_INVOICE_AMOUNT", message: error.message }, { status: 400 });
    }
    if (isPrismaCode(error, "P2002")) {
      const prior = await prisma.invoice.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey },
        include
      });
      if (prior && prior.requestHash === requestHash) {
        return Response.json({ item: publicInvoice(prior as unknown as InvoiceRecord), replay: true }, { status: 200 });
      }
      return Response.json({ error: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
    }
    throw error;
  }
}
