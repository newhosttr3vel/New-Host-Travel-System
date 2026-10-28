import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { normalizeJournalLines, JournalValidationError } from "@/lib/finance-journal";
import { hasPermission } from "@/lib/permissions";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const createJournalSchema = z.object({
  entryDate: dateOnly,
  description: z.string().trim().min(3).max(500),
  currency: z.string().regex(/^[A-Z]{3}$/),
  exchangeRate: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/),
  idempotencyKey: z.string().uuid(),
  lines: z.array(z.object({
    accountId: z.string().trim().min(1).max(80),
    memo: z.string().trim().max(200).optional(),
    debit: money,
    credit: money
  })).min(2).max(100)
});

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

const entryInclude = {
  lines: {
    include: {
      account: {
        select: { id: true, code: true, name: true, nameEn: true, type: true }
      }
    },
    orderBy: { createdAt: "asc" as const }
  }
};

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "finance:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const requestedSize = Number(url.searchParams.get("pageSize") ?? "20");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = Number.isInteger(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 100) : 20;
  const where = { tenantId: access.membership.tenantId, status: "POSTED" as const };
  const [items, total] = await prisma.$transaction([
    prisma.journalEntry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.journalEntry.count({ where })
  ]);
  const canReadFinance = hasPermission(access.membership.role, "finance:read");
  return Response.json({
    baseCurrency: access.membership.tenant.defaultCurrency,
    items: items.map((entry) => {
      const item = asPublicEntry(entry);
      return {
        ...item,
        lines: item.lines.map((line) => ({
          ...line,
          account: canReadFinance ? line.account : { id: line.account.id, code: line.account.code, name: "", nameEn: "", type: line.account.type }
        }))
      };
    }),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "finance:write");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = createJournalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  let normalized;
  try {
    normalized = normalizeJournalLines(parsed.data.lines, parsed.data.exchangeRate);
  } catch (error) {
    if (error instanceof JournalValidationError) {
      return Response.json({ error: "UNBALANCED_JOURNAL", message: error.message }, { status: 400 });
    }
    throw error;
  }

  const tenantId = access.membership.tenantId;
  const date = new Date(parsed.data.entryDate + "T12:00:00.000Z");
  const canonicalPayload = {
    entryDate: parsed.data.entryDate,
    description: parsed.data.description,
    currency: parsed.data.currency,
    exchangeRate: normalized.exchangeRate,
    lines: normalized.lines
  };
  const requestHash = createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");

  if (parsed.data.currency === access.membership.tenant.defaultCurrency && normalized.exchangeRate !== "1.00000000") {
    return Response.json({ error: "BASE_CURRENCY_RATE_MUST_BE_ONE" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const prior = await tx.journalEntry.findFirst({
        where: { tenantId, idempotencyKey: parsed.data.idempotencyKey },
        include: entryInclude
      });
      if (prior) {
        if (prior.requestHash !== requestHash) return { error: "IDEMPOTENCY_KEY_REUSED" as const };
        return { entry: prior, replay: true };
      }

      const accountIds = [...new Set(normalized.lines.map((line) => line.accountId))];
      const foundAccounts = await tx.ledgerAccount.findMany({
        where: { tenantId, isActive: true, id: { in: accountIds } },
        select: { id: true }
      });
      if (foundAccounts.length !== accountIds.length) return { error: "ACCOUNT_NOT_FOUND" as const };

      const reference = "JE-" + parsed.data.entryDate.replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          reference,
          entryDate: date,
          description: parsed.data.description,
          currency: parsed.data.currency,
          exchangeRate: normalized.exchangeRate,
          sourceType: "MANUAL",
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash,
          createdById: access.session.user.id,
          status: "POSTED"
        }
      });
      await tx.journalLine.createMany({
        data: normalized.lines.map((line) => ({
          tenantId,
          journalEntryId: entry.id,
          accountId: line.accountId,
          memo: line.memo,
          debit: line.debit,
          credit: line.credit,
          baseDebit: line.baseDebit,
          baseCredit: line.baseCredit
        }))
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          userId: access.session.user.id,
          action: "JOURNAL_ENTRY_POSTED",
          entityType: "JournalEntry",
          entityId: entry.id,
          metadata: { reference, total: normalized.total, baseTotal: normalized.baseTotal, currency: parsed.data.currency }
        }
      });
      const complete = await tx.journalEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: entryInclude
      });
      return { entry: complete, replay: false };
    });

    if ("error" in result) return Response.json({ error: result.error }, { status: result.error === "IDEMPOTENCY_KEY_REUSED" ? 409 : 400 });
    return Response.json({
      item: asPublicEntry(result.entry),
      replay: result.replay,
      total: normalized.total,
      baseTotal: normalized.baseTotal,
      baseCurrency: access.membership.tenant.defaultCurrency
    }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (isPrismaCode(error, "P2002")) {
      return Response.json({ error: "CONFLICT_RETRY_WITH_SAME_IDEMPOTENCY_KEY" }, { status: 409 });
    }
    throw error;
  }
}
