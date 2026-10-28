import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };
const customerPatchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  type: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
  companyName: z.string().trim().max(160).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional()
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "customers:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = customerPatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const values = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.companyName !== undefined ? { companyName: input.companyName || null } : {}),
    ...(input.email !== undefined ? { email: input.email || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || null } : {})
  };

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      select: { id: true }
    });
    if (!existing) return null;
    await tx.customer.updateMany({ where: { id, tenantId: access.membership.tenantId, archivedAt: null }, data: values });
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "CUSTOMER_UPDATED", entityType: "Customer", entityId: id }
    });
    return tx.customer.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      select: { id: true, type: true, name: true, companyName: true, email: true, phone: true, notes: true, createdAt: true, updatedAt: true }
    });
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ item: result });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "customers:archive");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      data: { archivedAt: new Date() }
    });
    if (updated.count !== 1) return false;
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "CUSTOMER_ARCHIVED", entityType: "Customer", entityId: id }
    });
    return true;
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
