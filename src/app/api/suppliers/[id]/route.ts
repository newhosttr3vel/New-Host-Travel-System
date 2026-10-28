import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };
const supplierPatchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  category: z.enum(["HOTEL", "AIRLINE", "TRANSPORT", "VISA_PROVIDER", "TOUR_OPERATOR", "OTHER"]).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional()
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = supplierPatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.contactName !== undefined ? { contactName: input.contactName || null } : {}),
    ...(input.email !== undefined ? { email: input.email || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || null } : {})
  };
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.supplier.findFirst({ where: { id, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true } });
    if (!existing) return null;
    await tx.supplier.updateMany({ where: { id, tenantId: access.membership.tenantId, archivedAt: null }, data });
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "SUPPLIER_UPDATED", entityType: "Supplier", entityId: id }
    });
    return tx.supplier.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      select: { id: true, name: true, category: true, contactName: true, email: true, phone: true, paymentTerms: true, notes: true, createdAt: true, updatedAt: true }
    });
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ item: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const archived = await prisma.$transaction(async (tx) => {
    const result = await tx.supplier.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      data: { archivedAt: new Date() }
    });
    if (result.count !== 1) return false;
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "SUPPLIER_ARCHIVED", entityType: "Supplier", entityId: id }
    });
    return true;
  });
  if (!archived) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
