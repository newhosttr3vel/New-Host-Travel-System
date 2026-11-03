import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { ledgerAccountTypes } from "@/lib/finance-accounts";

const createAccountSchema = z.object({
  code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  type: z.enum(ledgerAccountTypes)
});

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "finance:read");
  if (!access.ok) return access.response;

  const accounts = await prisma.ledgerAccount.findMany({
    where: { tenantId: access.membership.tenantId, isActive: true },
    orderBy: [{ code: "asc" }]
  });

  return Response.json({
    baseCurrency: access.membership.tenant.defaultCurrency,
    items: accounts
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

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await prisma.ledgerAccount.create({
      data: {
        tenantId: access.membership.tenantId,
        code: parsed.data.code,
        name: parsed.data.name,
        nameEn: parsed.data.nameEn,
        type: parsed.data.type,
        isSystem: false
      }
    });
    await prisma.auditEvent.create({
      data: {
        tenantId: access.membership.tenantId,
        userId: access.session.user.id,
        action: "LEDGER_ACCOUNT_CREATED",
        entityType: "LedgerAccount",
        entityId: account.id,
        metadata: { code: account.code, type: account.type }
      }
    });
    return Response.json({ item: account }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "ACCOUNT_CODE_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
