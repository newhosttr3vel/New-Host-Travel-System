import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission, activateTenantRequestContext } from "@/lib/api-auth";

const branchSchema = z.object({ name: z.string().trim().min(2).max(100) });

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "settings:manage");
  if (!access.ok) {
    const read = await requireTenantPermission(request, "reservations:read");
    if (!read.ok) return read.response;
    const items = await prisma.branch.findMany({
      where: { tenantId: read.membership.tenantId, id: { in: read.membership.branchAssignments.map((item) => item.branchId) }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isActive: true }
    });
    return Response.json({ items });
  }
  const [items, memberships] = await prisma.$transaction(async (tx) => Promise.all([
    tx.branch.findMany({
      where: { tenantId: access.membership.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isActive: true, memberships: { select: { membershipId: true } } }
    }),
    tx.tenantMembership.findMany({
      where: { tenantId: access.membership.tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } }
    })
  ]));
  return Response.json({ items, memberships });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "settings:manage");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = branchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const base = parsed.data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "branch";
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({
      data: { tenantId: access.membership.tenantId, name: parsed.data.name, slug: base + "-" + randomUUID().slice(0, 6) }
    });
    await tx.auditEvent.create({ data: {
      tenantId: access.membership.tenantId, userId: access.session.user.id,
      action: "BRANCH_CREATED", entityType: "Branch", entityId: created.id
    } });
    return created;
  });
  return Response.json({ item }, { status: 201 });
}
