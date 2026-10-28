import { z } from "zod";
import { requireTenantPermission } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { canTransitionReservationStatus } from "@/lib/reservation-workflow";
import { listRows, updateRow, logAudit } from "@/lib/sheets-store";

type RouteContext = { params: Promise<{ id: string }> };
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(new Date(v + "T00:00:00.000Z").getTime()) && new Date(v + "T00:00:00.000Z").toISOString().slice(0, 10) === v);
const optionalDate = z.union([dateOnly, z.literal("")]).optional(), money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const schema = z.object({
  customerId: z.string().trim().min(1).max(80).optional(), supplierId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  serviceType: z.enum(["HOTEL", "FLIGHT", "VISA", "TRANSPORT", "UMRAH_PACKAGE", "HAJJ_PACKAGE", "TOUR", "OTHER"]).optional(),
  status: z.enum(["INQUIRY", "QUOTATION", "PENDING", "ON_HOLD", "CONFIRMED", "PARTIALLY_PAID", "FULLY_PAID", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  startDate: optionalDate, endDate: optionalDate, currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  saleAmount: money.optional(), costAmount: money.optional(), notes: z.string().trim().max(2000).optional()
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  const { id } = await context.params, tenantId = access.membership.tenantId, canReadCosts = hasPermission(access.membership.role, "finance:read");
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data;
  if (!canReadCosts && v.costAmount !== undefined) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const [reservationRows, customerRows, supplierRows] = await Promise.all([listRows("Reservations"), listRows("Customers"), listRows("Suppliers")]);
  const existing = reservationRows.find((r) => r.id === id && r.tenantId === tenantId && !r.archivedAt);
  if (!existing) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (v.status && !canTransitionReservationStatus(existing.status, v.status)) return Response.json({ error: "INVALID_STATUS_TRANSITION", currentStatus: existing.status }, { status: 409 });
  const start = v.startDate === undefined ? existing.startDate : v.startDate, end = v.endDate === undefined ? existing.endDate : v.endDate;
  if (start && end && end < start) return Response.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });
  const customerId = v.customerId ?? existing.customerId, customer = customerRows.find((r) => r.id === customerId && r.tenantId === tenantId && !r.archivedAt);
  if (!customer) return Response.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 400 });
  const supplierId = v.supplierId === undefined ? existing.supplierId : v.supplierId, supplier = supplierId ? supplierRows.find((r) => r.id === supplierId && r.tenantId === tenantId && !r.archivedAt) : undefined;
  if (supplierId && !supplier) return Response.json({ error: "SUPPLIER_NOT_FOUND" }, { status: 400 });
  const now = new Date().toISOString();
  const changes = {
    ...(v.customerId !== undefined ? { customerId: v.customerId } : {}), ...(v.supplierId !== undefined ? { supplierId: v.supplierId, supplierTenantId: v.supplierId ? tenantId : "" } : {}),
    ...(v.serviceType !== undefined ? { serviceType: v.serviceType } : {}), ...(v.status !== undefined ? { status: v.status } : {}),
    ...(v.startDate !== undefined ? { startDate: v.startDate } : {}), ...(v.endDate !== undefined ? { endDate: v.endDate } : {}),
    ...(v.currency !== undefined ? { currency: v.currency } : {}), ...(v.saleAmount !== undefined ? { saleAmount: v.saleAmount } : {}),
    ...(v.costAmount !== undefined ? { costAmount: v.costAmount } : {}), ...(v.notes !== undefined ? { notes: v.notes || "" } : {}), updatedAt: now
  };
  const updated = await updateRow("Reservations", (r) => r.id === id && r.tenantId === tenantId && !r.archivedAt && r.updatedAt === existing.updatedAt && r.status === existing.status, changes);
  if (!updated) return Response.json({ error: "CONFLICT" }, { status: 409 });
  await logAudit({ tenantId, userId: access.session.user.id, action: v.status && v.status !== existing.status ? "RESERVATION_STATUS_CHANGED" : "RESERVATION_UPDATED", entityType: "Reservation", entityId: id, metadata: { previousStatus: existing.status, nextStatus: updated.status } });
  return Response.json({ item: { ...updated, startDate: updated.startDate || null, endDate: updated.endDate || null, costAmount: canReadCosts ? updated.costAmount : null, notes: updated.notes || null, customer: { id: customer.id, name: customer.name }, supplier: supplier ? { id: supplier.id, name: supplier.name } : null } });
}
export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  const { id } = await context.params, now = new Date().toISOString();
  const result = await updateRow("Reservations", (r) => r.id === id && r.tenantId === access.membership.tenantId && !r.archivedAt, { archivedAt: now, updatedAt: now });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "RESERVATION_ARCHIVED", entityType: "Reservation", entityId: id });
  return Response.json({ ok: true });
}
