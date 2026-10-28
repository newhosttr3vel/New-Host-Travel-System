import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { amountToCents, centsToAmount, normalizeJournalLines, JournalValidationError } from "@/lib/finance-journal";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T12:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const paymentSchema = z.object({
  invoiceId: z.string().trim().min(1).max(80),
  paymentDate: dateOnly,
  amount: money,
  accountId: z.string().trim().min(1).max(80),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "ELECTRONIC_WALLET", "THNDR", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().uuid()
});

type DecimalValue = { toString(): string };
type PaymentRecord = {
  id: string;
  receiptNumber: string;
  paymentDate: Date;
  method: string;
  amount: DecimalValue;
  currency: string;
  exchangeRate: DecimalValue;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  invoice: { id: string; reference: string; total: DecimalValue; paidAmount: DecimalValue; status: string; currency: string };
  account: { id: string; code: string; name: string; nameEn: string };
  journalEntry: { id: string; reference: string };
};

const paymentInclude = {
  invoice: { select: { id: true, reference: true, total: true, paidAmount: true, status: true, currency: true } },
  account: { select: { id: true, code: true, name: true, nameEn: true } },
  journalEntry: { select: { id: true, reference: true } }
} as const;

function publicPayment(payment: PaymentRecord) {
  return {
    id: payment.id,
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paymentDate.toISOString(),
    method: payment.method,
    amount: payment.amount.toString(),
    currency: payment.currency,
    exchangeRate: payment.exchangeRate.toString(),
    reference: payment.reference,
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
    invoice: {
      ...payment.invoice,
      total: payment.invoice.total.toString(),
      paidAmount: payment.invoice.paidAmount.toString()
    },
    account: payment.account,
    journalEntry: payment.journalEntry
  };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function dayAtNoon(value: string) { return new Date(value + "T12:00:00.000Z"); }

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "finance:write");
  if (!access.ok) return access.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const tenantId = access.membership.tenantId;
  let amountCents: bigint;
  try {
    amountCents = amountToCents(input.amount);
    if (amountCents <= 0n) throw new JournalValidationError("Payment amount must be greater than zero.");
  } catch (error) {
    if (error instanceof JournalValidationError) return Response.json({ error: "INVALID_PAYMENT_AMOUNT", message: error.message }, { status: 400 });
    throw error;
  }

  const canonical = {
    invoiceId: input.invoiceId,
    paymentDate: input.paymentDate,
    amount: centsToAmount(amountCents),
    accountId: input.accountId,
    method: input.method,
    reference: input.reference?.trim() ?? "",
    notes: input.notes?.trim() ?? ""
  };
  const requestHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const prior = await tx.customerPayment.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey },
        include: paymentInclude
      });
      if (prior) {
        if (prior.requestHash !== requestHash) return { error: "IDEMPOTENCY_KEY_REUSED" as const };
        return { item: prior, replay: true as const };
      }

      const invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, tenantId },
        select: {
          id: true, reference: true, status: true, currency: true, exchangeRate: true,
          total: true, paidAmount: true, updatedAt: true, journalEntryId: true
        }
      });
      if (!invoice) return { error: "INVOICE_NOT_FOUND" as const };
      if (invoice.status === "VOID") return { error: "INVOICE_VOID" as const };
      if (invoice.status === "PAID") return { error: "INVOICE_ALREADY_PAID" as const };
      const currentPaid = amountToCents(invoice.paidAmount.toString());
      const total = amountToCents(invoice.total.toString());
      const remaining = total - currentPaid;
      if (amountCents > remaining) {
        return { error: "PAYMENT_EXCEEDS_BALANCE" as const, outstanding: centsToAmount(remaining) };
      }

      const account = await tx.ledgerAccount.findFirst({
        where: { id: input.accountId, tenantId, isActive: true, type: "ASSET" },
        select: { id: true, code: true }
      });
      if (!account) return { error: "PAYMENT_ACCOUNT_INVALID" as const };
      const receivable = await tx.ledgerAccount.findFirst({
        where: { tenantId, code: "1100", type: "ASSET", isActive: true },
        select: { id: true }
      });
      if (!receivable) return { error: "RECEIVABLE_ACCOUNT_MISSING" as const };

      const newPaid = currentPaid + amountCents;
      const newStatus = newPaid === total ? "PAID" as const : "PARTIALLY_PAID" as const;
      const date = dayAtNoon(input.paymentDate);
      const receiptNumber = "RCT-" + input.paymentDate.replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
      const journalReference = receiptNumber.replace("RCT-", "J-RCT-");
      const normalized = normalizeJournalLines([
        { accountId: account.id, memo: "Customer receipt " + receiptNumber, debit: centsToAmount(amountCents), credit: "0.00" },
        { accountId: receivable.id, memo: "Receivable settlement - " + invoice.reference, debit: "0.00", credit: centsToAmount(amountCents) }
      ], invoice.exchangeRate.toString());

      const journal = await tx.journalEntry.create({
        data: {
          tenantId, reference: journalReference, entryDate: date,
          description: "Customer receipt " + receiptNumber + " - " + invoice.reference,
          currency: invoice.currency, exchangeRate: normalized.exchangeRate,
          status: "POSTED", sourceType: "CUSTOMER_PAYMENT",
          idempotencyKey: "payment:" + input.idempotencyKey,
          requestHash, createdById: access.session.user.id
        }
      });
      await tx.journalLine.createMany({
        data: normalized.lines.map((line) => ({
          tenantId, journalEntryId: journal.id, accountId: line.accountId, memo: line.memo,
          debit: line.debit, credit: line.credit, baseDebit: line.baseDebit, baseCredit: line.baseCredit
        }))
      });
      const payment = await tx.customerPayment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          accountId: account.id,
          journalEntryId: journal.id,
          receiptNumber,
          paymentDate: date,
          method: input.method,
          amount: centsToAmount(amountCents),
          currency: invoice.currency,
          exchangeRate: normalized.exchangeRate,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          reference: input.reference?.trim() || null,
          notes: input.notes?.trim() || null,
          createdById: access.session.user.id
        },
        include: paymentInclude
      });
      const changed = await tx.invoice.updateMany({
        where: { id: invoice.id, tenantId, updatedAt: invoice.updatedAt, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        data: { paidAmount: centsToAmount(newPaid), status: newStatus }
      });
      if (changed.count !== 1) throw new Error("INVOICE_BALANCE_CHANGED");

      await tx.auditEvent.create({
        data: {
          tenantId, userId: access.session.user.id, action: "CUSTOMER_PAYMENT_RECEIVED",
          entityType: "CustomerPayment", entityId: payment.id,
          metadata: { receiptNumber, invoiceReference: invoice.reference, amount: centsToAmount(amountCents), currency: invoice.currency, journalReference: journal.reference }
        }
      });
      return { item: payment, replay: false as const };
    });

    if ("error" in outcome) {
      const messages: Record<string, string> = {
        IDEMPOTENCY_KEY_REUSED: "Idempotency key is already used for different payment data.",
        INVOICE_NOT_FOUND: "Invoice not found in this company.",
        INVOICE_VOID: "A void invoice cannot receive payments.",
        INVOICE_ALREADY_PAID: "This invoice is already fully paid.",
        PAYMENT_EXCEEDS_BALANCE: "Payment exceeds the outstanding invoice balance.",
        PAYMENT_ACCOUNT_INVALID: "Select an active asset account belonging to this company.",
        RECEIVABLE_ACCOUNT_MISSING: "Default receivable account 1100 is missing or inactive."
      };
      return Response.json({ error: outcome.error, message: messages[outcome.error], outstanding: "outstanding" in outcome ? outcome.outstanding : undefined }, {
        status: outcome.error === "IDEMPOTENCY_KEY_REUSED" ? 409 : 400
      });
    }
    return Response.json({ item: publicPayment(outcome.item as unknown as PaymentRecord), replay: outcome.replay }, { status: outcome.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_BALANCE_CHANGED") {
      return Response.json({ error: "INVOICE_BALANCE_CHANGED", message: "The invoice balance changed while this receipt was being posted. Reload and try again." }, { status: 409 });
    }
    if (isPrismaCode(error, "P2002")) {
      const prior = await prisma.customerPayment.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey },
        include: paymentInclude
      });
      if (prior && prior.requestHash === requestHash) {
        return Response.json({ item: publicPayment(prior as unknown as PaymentRecord), replay: true }, { status: 200 });
      }
      return Response.json({ error: "PAYMENT_CONFLICT" }, { status: 409 });
    }
    throw error;
  }
}
