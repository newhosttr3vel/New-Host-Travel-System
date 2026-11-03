import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission, activateTenantRequestContext } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };
const hotelSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional()
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = hotelSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.hotel.updateMany({
        where: { id, tenantId: access.membership.tenantId, archivedAt: null },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.city !== undefined ? { city: input.city || null } : {}),
          ...(input.country !== undefined ? { country: input.country || null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {})
        }
      });
      if (updated.count !== 1) return null;
      const item = await tx.hotel.findFirst({
        where: { id, tenantId: access.membership.tenantId, archivedAt: null },
        select: { id: true, name: true, city: true, country: true, notes: true, createdAt: true, updatedAt: true }
      });
      await tx.auditEvent.create({
        data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "HOTEL_UPDATED", entityType: "Hotel", entityId: id }
      });
      return item;
    });
    if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ item: result });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json({ error: "HOTEL_NAME_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  const { id } = await context.params;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotel.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      data: { archivedAt: new Date() }
    });
    if (updated.count !== 1) return false;
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "HOTEL_ARCHIVED", entityType: "Hotel", entityId: id }
    });
    return true;
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
