import { defaultLedgerAccounts } from "@/lib/finance-accounts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  defaultCurrency: z.enum(["EGP", "SAR", "USD"]),
  defaultLanguage: z.enum(["ar", "en"]).default("ar"),
  timeZone: z.string().trim().min(3).max(80).default("Africa/Cairo")
});

function createSlug(name: string) {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "travel-agency";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.tenantMembership.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (existing) return Response.json({ error: "WORKSPACE_ALREADY_EXISTS" }, { status: 409 });

  const data = parsed.data;
  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: data.companyName,
        slug: createSlug(data.companyName),
        status: "TRIAL",
        defaultLanguage: data.defaultLanguage,
        defaultCurrency: data.defaultCurrency,
        timeZone: data.timeZone
      }
    });
    await tx.ledgerAccount.createMany({
      data: defaultLedgerAccounts.map((account) => ({ tenantId: created.id, ...account, isSystem: true }))
    });
    await tx.tenantMembership.create({ data: { tenantId: created.id, userId: session.user.id, role: "OWNER" } });
    await tx.auditEvent.create({
      data: { tenantId: created.id, userId: session.user.id, action: "TENANT_CREATED", entityType: "Tenant", entityId: created.id }
    });
    return created;
  });

  return Response.json({ ok: true, tenantId: tenant.id }, { status: 201 });
}
