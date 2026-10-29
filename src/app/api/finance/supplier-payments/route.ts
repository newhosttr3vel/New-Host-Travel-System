import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { amountToCents, centsToAmount, normalizeJournalLines, JournalValidationError } from "@/lib/finance-journal";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T12:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const schema = z.object({
  supplierBillId: z.string().trim().min(1).max(80),
  paymentDate: dateOnly,
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
  accountId: z.string().trim().min(1).max(80),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "ELECTRONIC_WALLET", "THNDR", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().uuid()
});
function dayAtNoon(value: string) { return new Date(value + "T12:00:00.000Z"); }
function isPrismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
const include = {
  supplierBill: { select: { id: true, reference: true, total: true, paidAmount: true, status: true, currency: true } },
  account: { select: { id: true, code: true, name: true, nameEn: true } },
  journalEntry: { select: { id: true, reference: true } }
} as const;
function publicPayment(payment: any) {
  return {
    ...payment, paymentDate: payment.paymentDate.toISOString(),
    amount: payment.amount.toString(), exchangeRate: payment.exchangeRate.toString(), createdAt: payment.createdAt.toISOString(),
    supplierBill: { ...payment.supplierBill, total: payment.supplierBill.total.toString(), paidAmount: payment.supplierBill.paidAmount.toString() }
  };
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
  let cents: bigint;
  try {
    cents = amountToCents(input.amount);
    if (cents <= 0n) throw new JournalValidationError("Payment must be greater than zero.");
  } catch (error) {
    if (error instanceof JournalValidationError) return Response.json({ error: "INVALID_PAYMENT_AMOUNT", message: error.message }, { status: 400 });
    throw error;
  }
  const canonical = {
    supplierBillId: input.supplierBillId, paymentDate: input.paymentDate, amount: centsToAmount(cents),
    accountId: input.accountId, method: input.method, reference: input.reference?.trim() ?? "", notes: input.notes?.trim() ?? ""
  };
  const requestHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const prior = await tx.supplierPayment.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey }, include });
      if (prior) {
        if (prior.requestHash !== requestHash) return { error: "IDEMPOTENCY_KEY_REUSED" as const };
        return { item: prior, replay: true as const };
      }
      const bill = await tx.supplierBill.findFirst({
        where: { id: input.supplierBillId, tenantId },
        select: { id: true, reference: true, status: true, currency: true, exchangeRate: true, total: true, paidAmount: true, updatedAt: true }
      });
      if (!bill) return { error: "SUPPLIER_BILL_NOT_FOUND" as const };
      if (bill.status === "VOID") return { error: "SUPPLIER_BILL_VOID" as const };
      if (bill.status === "PAID") return { error: "SUPPLIER_BILL_ALREADY_PAID" as const };
      const paid = amountToCents(bill.paidAmount.toString());
      const total = amountToCents(bill.total.toString());
      const outstanding = total - paid;
      if (cents > outstanding) return { error: "PAYMENT_EXCEEDS_BALANCE" as const, outstanding: centsToAmount(outstanding) };
      const account = await tx.ledgerAccount.findFirst({ where: { id: input.accountId, tenantId, type: "ASSET", isActive: true }, select: { id: true } });
      if (!account) return { error: "PAYMENT_ACCOUNT_INVALID" as const };
      const payable = await tx.ledgerAccount.findFirst({ where: { tenantId, code: "2000", type: "LIABILITY", isActive: true }, select: { id: true } });
      if (!payable) return { error: "PAYABLE_ACCOUNT_MISSING" as const };
      const newPaid = paid + cents;
      const newStatus = newPaid === total ? "PAID" as const : "PARTIALLY_PAID" as const;
      const date = dayAtNoon(input.paymentDate);
      const number = "PAY-" + input.paymentDate.replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
      const journalLines = normalizeJournalLines([
        { accountId: payable.id, memo: "Supplier payment " + number, debit: centsToAmount(cents), credit: "0.00" },
        { accountId: account.id, memo: "Supplier bill " + bill.reference, debit: "0.00", credit: centsToAmount(cents) }
      ], bill.exchangeRate.toString());
      const journal = await tx.journalEntry.create({ data: {
        tenantId, reference: "J-" + number, entryDate: date, description: "Supplier payment " + number + " - " + bill.reference,
        currency: bill.currency, exchangeRate: journalLines.exchangeRate, status: "POSTED", sourceType: "SUPPLIER_PAYMENT",
        idempotencyKey: "supplier-payment:" + input.idempotencyKey, requestHash, createdById: access.session.user.id
      } });
      await tx.journalLine.createMany({ data: journalLines.lines.map((line) => ({
        tenantId, journalEntryId: journal.id, accountId: line.accountId, memo: line.memo,
        debit: line.debit, credit: line.credit, baseDebit: line.baseDebit, baseCredit: line.baseCredit
      })) });
      const payment = await tx.supplierPayment.create({ data: {
        tenantId, supplierBillId: bill.id, accountId: account.id, journalEntryId: journal.id,
        paymentNumber: number, paymentDate: date, method: input.method, amount: centsToAmount(cents),
        currency: bill.currency, exchangeRate: journalLines.exchangeRate, idempotencyKey: input.idempotencyKey,
        requestHash, reference: input.reference?.trim() || null, notes: input.notes?.trim() || null, createdById: access.session.user.id
      } });
      const changed = await tx.supplierBill.updateMany({
        where: { id: bill.id, tenantId, updatedAt: bill.updatedAt, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        data: { paidAmount: centsToAmount(newPaid), status: newStatus }
      });
      if (changed.count !== 1) throw new Error("SUPPLIER_BILL_BALANCE_CHANGED");
      const complete = await tx.supplierPayment.findUniqueOrThrow({ where: { id: payment.id }, include });
      await tx.auditEvent.create({ data: {
        tenantId, userId: access.session.user.id, action: "SUPPLIER_PAYMENT_POSTED",
        entityType: "SupplierPayment", entityId: payment.id,
        metadata: { paymentNumber: number, supplierBillReference: bill.reference, amount: centsToAmount(cents), currency: bill.currency, journalReference: journal.reference }
      } });
      return { item: complete, replay: false as const };
    });
    if ("error" in outcome) {
      const messages: Record<string, string> = {
        IDEMPOTENCY_KEY_REUSED: "Idempotency key used for different payment data.",
        SUPPLIER_BILL_NOT_FOUND: "Supplier bill not found in this company.",
        SUPPLIER_BILL_VOID: "A void supplier bill cannot be paid.",
        SUPPLIER_BILL_ALREADY_PAID: "Supplier bill is already fully paid.",
        PAYMENT_EXCEEDS_BALANCE: "Payment exceeds outstanding supplier bill balance.",
        PAYMENT_ACCOUNT_INVALID: "Choose an active asset account belonging to this company.",
        PAYABLE_ACCOUNT_MISSING: "Default accounts payable account 2000 is missing or inactive."
      };
      return Response.json({ error: outcome.error, message: messages[outcome.error] ?? "Payment failed.", outstanding: "outstanding" in outcome ? outcome.outstanding : undefined }, { status: outcome.error === "IDEMPOTENCY_KEY_REUSED" ? 409 : 400 });
    }
    return Response.json({ item: publicPayment(outcome.item), replay: outcome.replay }, { status: outcome.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof JournalValidationError) return Response.json({ error: "INVALID_PAYMENT_AMOUNT", message: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "SUPPLIER_BILL_BALANCE_CHANGED") {
      return Response.json({ error: "SUPPLIER_BILL_BALANCE_CHANGED", message: "The supplier bill changed; reload and retry." }, { status: 409 });
    }
    if (isPrismaCode(error, "P2002")) {
      const prior = await prisma.supplierPayment.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey }, include });
      if (prior && prior.requestHash === requestHash) return Response.json({ item: publicPayment(prior), replay: true }, { status: 200 });
      return Response.json({ error: "SUPPLIER_PAYMENT_CONFLICT" }, { status: 409 });
    }
    throw error;
  }
}
