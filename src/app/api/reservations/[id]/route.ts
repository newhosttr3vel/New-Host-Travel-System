import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { canTransitionReservationStatus } from "@/lib/reservation-workflow";

type RouteContext = { params: Promise<{ id: string }> };
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([dateOnly, z.literal("")]).optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const patchSchema = z.object({
  customerId: z.string().trim().min(1).max(80).optional(),
  supplierId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  serviceType: z.enum(["HOTEL", "FLIGHT", "VISA", "TRANSPORT", "UMRAH_PACKAGE", "HAJJ_PACKAGE", "TOUR", "OTHER"]).optional(),
  status: z.enum(["INQUIRY", "QUOTATION", "PENDING", "ON_HOLD", "CONFIRMED", "PARTIALLY_PAID", "FULLY_PAID", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  saleAmount: money.optional(),
  costAmount: money.optional(),
  notes: z.string().trim().max(2000).optional()
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

function asDate(value: string | undefined) {
  return value === undefined ? undefined : value ? new Date(value + "T12:00:00.000Z") : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null }
    });
    if (!existing) return { error: "NOT_FOUND" as const };
    if (input.status && !canTransitionReservationStatus(existing.status, input.status)) {
      return { error: "INVALID_STATUS_TRANSITION" as const, currentStatus: existing.status };
    }
    const startDate = asDate(input.startDate) === undefined ? existing.startDate : asDate(input.startDate);
    const endDate = asDate(input.endDate) === undefined ? existing.endDate : asDate(input.endDate);
    if (startDate && endDate && endDate < startDate) return { error: "INVALID_DATE_RANGE" as const };

    if (input.customerId) {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true } });
      if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };
    }
    const supplierId = input.supplierId === undefined ? existing.supplierId : (input.supplierId || null);
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true } });
      if (!supplier) return { error: "SUPPLIER_NOT_FOUND" as const };
    }

    const data = {
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null, supplierTenantId: input.supplierId ? access.membership.tenantId : null } : {}),
      ...(input.serviceType !== undefined ? { serviceType: input.serviceType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: asDate(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: asDate(input.endDate) } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.saleAmount !== undefined ? { saleAmount: input.saleAmount } : {}),
      ...(input.costAmount !== undefined ? { costAmount: input.costAmount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {})
    };
    const update = await tx.reservation.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null, updatedAt: existing.updatedAt, status: existing.status },
      data
    });
    if (update.count !== 1) return { error: "CONFLICT" as const };
    await tx.auditEvent.create({
      data: {
        tenantId: access.membership.tenantId,
        userId: access.session.user.id,
        action: input.status && input.status !== existing.status ? "RESERVATION_STATUS_CHANGED" : "RESERVATION_UPDATED",
        entityType: "Reservation",
        entityId: id,
        metadata: { previousStatus: existing.status, nextStatus: input.status ?? existing.status }
      }
    });
    const item = await tx.reservation.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      include: { customer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } }
    });
    return { item };
  });

  if ("error" in result) {
    const statusCode =
      result.error === "NOT_FOUND" ? 404 :
      result.error === "INVALID_STATUS_TRANSITION" || result.error === "CONFLICT" ? 409 : 400;
    return Response.json({ error: result.error, ...("currentStatus" in result ? { currentStatus: result.currentStatus } : {}) }, { status: statusCode });
  }
  if (!result.item) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ item: { ...result.item, saleAmount: result.item.saleAmount.toString(), costAmount: result.item.costAmount.toString() } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      data: { archivedAt: new Date() }
    });
    if (updated.count !== 1) return false;
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "RESERVATION_ARCHIVED", entityType: "Reservation", entityId: id }
    });
    return true;
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
