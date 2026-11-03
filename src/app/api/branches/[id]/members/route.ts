import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission, activateTenantRequestContext } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({ membershipId: z.string().trim().min(1).max(80) });

export async function POST(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "settings:manage");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  const { id: branchId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const ok = await prisma.$transaction(async (tx) => {
    const [branch, membership] = await Promise.all([
      tx.branch.findFirst({ where: { id: branchId, tenantId: access.membership.tenantId, isActive: true }, select: { id: true } }),
      tx.tenantMembership.findFirst({ where: { id: parsed.data.membershipId, tenantId: access.membership.tenantId }, select: { id: true, userId: true } })
    ]);
    if (!branch || !membership) return false;
    await tx.branchMembership.upsert({
      where: { branchId_membershipId: { branchId, membershipId: membership.id } },
      create: { tenantId: access.membership.tenantId, branchId, membershipId: membership.id },
      update: {}
    });
    await tx.auditEvent.create({ data: {
      tenantId: access.membership.tenantId, userId: access.session.user.id,
      action: "BRANCH_MEMBER_ASSIGNED", entityType: "BranchMembership", entityId: membership.id,
      metadata: { branchId, userId: membership.userId }
    } });
    return true;
  });
  if (!ok) return Response.json({ error: "BRANCH_OR_MEMBERSHIP_NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "settings:manage");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  const { id: branchId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const removed = await prisma.$transaction(async (tx) => {
    const result = await tx.branchMembership.deleteMany({
      where: { tenantId: access.membership.tenantId, branchId, membershipId: parsed.data.membershipId }
    });
    if (result.count !== 1) return false;
    await tx.auditEvent.create({ data: {
      tenantId: access.membership.tenantId, userId: access.session.user.id,
      action: "BRANCH_MEMBER_REMOVED", entityType: "BranchMembership", entityId: parsed.data.membershipId,
      metadata: { branchId }
    } });
    return true;
  });
  if (!removed) return Response.json({ error: "ASSIGNMENT_NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
