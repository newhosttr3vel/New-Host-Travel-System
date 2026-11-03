import { randomUUID } from "node:crypto";
import { defaultLedgerAccounts } from "@/lib/finance-accounts";
import { prisma } from "@/lib/prisma";

export type CreateWorkspaceInput = {
  userId: string;
  companyName: string;
  defaultCurrency: "EGP" | "SAR" | "USD";
  defaultLanguage: "ar" | "en";
  timeZone: string;
};

function createSlug(name: string) {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "travel-agency";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

/**
 * Serializes onboarding attempts for one user so parallel requests cannot
 * create multiple owner workspaces before either membership is committed.
 */
export async function createWorkspaceForUser(input: CreateWorkspaceInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`;

    const existing = await tx.tenantMembership.findFirst({
      where: { userId: input.userId },
      select: { id: true },
    });
    if (existing) return null;

    const tenant = await tx.tenant.create({
      data: {
        name: input.companyName,
        slug: createSlug(input.companyName),
        status: "TRIAL",
        defaultLanguage: input.defaultLanguage,
        defaultCurrency: input.defaultCurrency,
        timeZone: input.timeZone,
      },
    });
    await tx.ledgerAccount.createMany({
      data: defaultLedgerAccounts.map((account) => ({
        tenantId: tenant.id,
        ...account,
        isSystem: true,
      })),
    });
    await tx.tenantMembership.create({
      data: { tenantId: tenant.id, userId: input.userId, role: "OWNER" },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        userId: input.userId,
        action: "TENANT_CREATED",
        entityType: "Tenant",
        entityId: tenant.id,
      },
    });

    return { tenantId: tenant.id };
  });
}
