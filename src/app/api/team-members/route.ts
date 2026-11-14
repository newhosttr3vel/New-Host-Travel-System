import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { prisma, setTenantRlsContext } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant-context";
import type { TenantRole } from "@/lib/permissions";

const roles = ["BRANCH_MANAGER", "RESERVATIONS_MANAGER", "RESERVATIONS_AGENT", "ACCOUNTANT", "SALES", "VISA_OFFICER", "OPERATIONS", "AUDITOR", "READ_ONLY"] as const;
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(roles),
});
async function ownerContext(request: Request) {
  const context = await getTenantContext(request.headers);
  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  if (!context.session?.user || !context.session.user.emailVerified || !ownerEmail ||
      context.session.user.email.toLowerCase() !== ownerEmail || context.membership?.role !== "OWNER") return null;
  setTenantRlsContext({ userId: context.session.user.id, tenantId: context.membership.tenantId });
  return context;
}
export async function GET(request: Request) {
  const context = await ownerContext(request);
  if (!context?.membership) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const members = await prisma.tenantMembership.findMany({
    where: { tenantId: context.membership.tenantId },
    include: { user: { select: { id: true, name: true, email: true, emailVerified: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ members: members.map(({ id, role, createdAt, user }) => ({ id, role, createdAt, user })) });
}
export async function POST(request: Request) {
  const context = await ownerContext(request);
  if (!context?.membership) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  if (await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }))
    return Response.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });

  const userId = randomUUID();
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async tx => {
      await tx.user.create({ data: { id: userId, name: parsed.data.name, email: parsed.data.email, emailVerified: true } });
      await tx.account.create({ data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash } });
      await tx.tenantMembership.create({ data: { tenantId: context.membership!.tenantId, userId, role: parsed.data.role as TenantRole } });
      await tx.auditEvent.create({ data: {
        tenantId: context.membership!.tenantId, userId: context.session!.user.id,
        action: "TEAM_MEMBER_CREATED", entityType: "TenantMembership", entityId: userId,
        metadata: { email: parsed.data.email, role: parsed.data.role },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request.headers.get("user-agent"),
      } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      return Response.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, member: { id: userId, name: parsed.data.name, email: parsed.data.email, role: parsed.data.role } }, { status: 201 });
}
