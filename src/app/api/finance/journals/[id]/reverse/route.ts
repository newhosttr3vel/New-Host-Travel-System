import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };
const bodySchema = z.object({ idempotencyKey: z.string().uuid() });
const includeEntry = {
  reversals: { select: { id: true, reference: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, nameEn: true, type: true } }
    },
    orderBy: { createdAt: "asc" as const }
  }
};

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function asPublicEntry(entry: {
  id: string;
  reference: string;
  entryDate: Date;
  description: string;
  currency: string;
  exchangeRate: { toString(): string };
  status: string;
  sourceType: string;
  reversalOfId: string | null;
  reversals: Array<{ id: string; reference: string }>;
  createdAt: Date;
  lines: Array<{
    id: string;
    memo: string | null;
    debit: { toString(): string };
    credit: { toString(): string };
    baseDebit: { toString(): string };
    baseCredit: { toString(): string };
    account: { id: string; code: string; name: string; nameEn: string; type: string };
  }>;
}) {
  return {
    id: entry.id,
    reference: entry.reference,
    entryDate: entry.entryDate.toISOString(),
    description: entry.description,
    currency: entry.currency,
    exchangeRate: entry.exchangeRate.toString(),
    status: entry.status,
    sourceType: entry.sourceType,
    reversalOfId: entry.reversalOfId,
    isReversed: entry.reversals.length > 0,
    reversals: entry.reversals,
    createdAt: entry.createdAt.toISOString(),
    lines: entry.lines.map((line) => ({
      id: line.id,
      memo: line.memo,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
      baseDebit: line.baseDebit.toString(),
      baseCredit: line.baseCredit.toString(),
      account: line.account
    }))
  };
}

function dateInTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return new Date(get("year") + "-" + get("month") + "-" + get("day") + "T12:00:00.000Z");
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "finance:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const tenantId = access.membership.tenantId;
  const prior = await prisma.journalEntry.findFirst({
    where: { tenantId, idempotencyKey: parsed.data.idempotencyKey },
    include: includeEntry
  });
  if (prior) {
    if (prior.sourceType !== "REVERSAL" || prior.reversalOfId !== id) {
      return Response.json({ error: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
    }
    return Response.json({ item: asPublicEntry(prior), replay: true }, { status: 200 });
  }

  const original = await prisma.journalEntry.findFirst({
    where: { id, tenantId, status: "POSTED" },
    include: includeEntry
  });
  if (!original) return Response.json({ error: "JOURNAL_NOT_FOUND" }, { status: 404 });
  if (original.sourceType === "INVOICE" || original.sourceType === "CUSTOMER_PAYMENT") {
    return Response.json({
      error: "BUSINESS_DOCUMENT_REVERSAL_REQUIRED",
      message: "Reverse the linked invoice or receipt through its business workflow; direct journal reversal is disabled to preserve subledger balances."
    }, { status: 409 });
  }
  if (original.reversals.length > 0) {
    return Response.json({
      error: "ALREADY_REVERSED",
      reversalReference: original.reversals[0].reference
    }, { status: 409 });
  }

  const lines = original.lines.map((line) => ({
    accountId: line.accountId,
    memo: line.memo ? "Reversal: " + line.memo : "Reversal of " + original.reference,
    debit: line.credit.toString(),
    credit: line.debit.toString(),
    baseDebit: line.baseCredit.toString(),
    baseCredit: line.baseDebit.toString()
  }));
  const requestHash = createHash("sha256").update(JSON.stringify({
    reversalOfId: original.id,
    originalReference: original.reference,
    lines
  })).digest("hex");
  const entryDate = dateInTimeZone(access.membership.tenant.timeZone);
  const reference = "REV-" + entryDate.toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentReversal = await tx.journalEntry.findFirst({
        where: { tenantId, reversalOfId: original.id },
        select: { id: true, reference: true }
      });
      if (currentReversal) return { error: "ALREADY_REVERSED" as const, reference: currentReversal.reference };

      const priorIdempotent = await tx.journalEntry.findFirst({
        where: { tenantId, idempotencyKey: parsed.data.idempotencyKey },
        select: { id: true, sourceType: true, reversalOfId: true }
      });
      if (priorIdempotent) {
        if (priorIdempotent.sourceType === "REVERSAL" && priorIdempotent.reversalOfId === original.id) {
          const repeated = await tx.journalEntry.findUniqueOrThrow({
            where: { id: priorIdempotent.id },
            include: includeEntry
          });
          return { item: repeated, replay: true as const };
        }
        return { error: "IDEMPOTENCY_KEY_REUSED" as const };
      }

      const created = await tx.journalEntry.create({
        data: {
          tenantId,
          reference,
          entryDate,
          description: "Reverse " + original.reference + " — " + original.description,
          currency: original.currency,
          exchangeRate: original.exchangeRate,
          status: "POSTED",
          sourceType: "REVERSAL",
          reversalOfId: original.id,
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash,
          createdById: access.session.user.id
        }
      });
      await tx.journalLine.createMany({
        data: lines.map((line) => ({ tenantId, journalEntryId: created.id, ...line }))
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          userId: access.session.user.id,
          action: "JOURNAL_ENTRY_REVERSED",
          entityType: "JournalEntry",
          entityId: created.id,
          metadata: { originalReference: original.reference, reversalReference: created.reference }
        }
      });
      const complete = await tx.journalEntry.findUniqueOrThrow({
        where: { id: created.id },
        include: includeEntry
      });
      return { item: complete, replay: false as const };
    });

    if ("error" in result) {
      const status = result.error === "ALREADY_REVERSED" ? 409 : 409;
      return Response.json({ error: result.error, reversalReference: "reference" in result ? result.reference : undefined }, { status });
    }
    return Response.json({ item: asPublicEntry(result.item), replay: result.replay }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (isPrismaCode(error, "P2002")) {
      const existingReversal = await prisma.journalEntry.findFirst({
        where: { tenantId, reversalOfId: original.id },
        select: { reference: true }
      });
      if (existingReversal) {
        return Response.json({ error: "ALREADY_REVERSED", reversalReference: existingReversal.reference }, { status: 409 });
      }
      return Response.json({ error: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
    }
    throw error;
  }
}
