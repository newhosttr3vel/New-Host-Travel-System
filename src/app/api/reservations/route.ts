import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireTenantPermission } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { activeRowsForTenant } from "@/lib/tenant-data";
import { insertRow, listRows, logAudit } from "@/lib/sheets-store";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([dateOnly, z.literal("")]).optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const schema = z.object({
  customerId: z.string().trim().min(1).max(80), supplierId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  serviceType: z.enum(["HOTEL", "FLIGHT", "VISA", "TRANSPORT", "UMRAH_PACKAGE", "HAJJ_PACKAGE", "TOUR", "OTHER"]),
  startDate: optionalDate, endDate: optionalDate, currency: z.string().regex(/^[A-Z]{3}$/).default("EGP"),
  saleAmount: money.default("0"), costAmount: money.default("0"), notes: z.string().trim().max(2000).optional()
}).superRefine((v, ctx) => {
  if (v.startDate && v.endDate && v.startDate !== "" && v.endDate !== "" && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must not be earlier than start date." });
});
export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  const canReadCosts = hasPermission(access.membership.role, "finance:read");
  const url = new URL(request.url), search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
  const p = Number(url.searchParams.get("page") ?? "1"), s = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(p) && p > 0 ? Math.min(p, 100000) : 1, pageSize = Number.isInteger(s) && s > 0 ? Math.min(s, 100) : 25;
  const [reservationRows, customerRows, supplierRows] = await Promise.all([listRows("Reservations"), listRows("Customers"), listRows("Suppliers")]);
  const customers = activeRowsForTenant(customerRows, access.membership.tenantId), suppliers = activeRowsForTenant(supplierRows, access.membership.tenantId);
  const cm = new Map(customers.map((r) => [r.id, r])), sm = new Map(suppliers.map((r) => [r.id, r]));
  const rows = activeRowsForTenant(reservationRows, access.membership.tenantId)
    .filter((r) => !search || r.reference.toLocaleLowerCase().includes(search) || (cm.get(r.customerId)?.name ?? "").toLocaleLowerCase().includes(search))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.reference.localeCompare(b.reference));
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => {
    const customer = cm.get(r.customerId), supplier = r.supplierId ? sm.get(r.supplierId) : undefined;
    return { ...r, startDate: r.startDate || null, endDate: r.endDate || null, saleAmount: r.saleAmount || "0",
      costAmount: canReadCosts ? r.costAmount || "0" : null, notes: r.notes || null,
      customer: customer ? { id: customer.id, name: customer.name, type: customer.type } : { id: r.customerId, name: "Unknown customer" },
      supplier: supplier ? { id: supplier.id, name: supplier.name, category: supplier.category } : null };
  });
  return Response.json({ items, pagination: { page, pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) } });
}
export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data, tenantId = access.membership.tenantId, canReadCosts = hasPermission(access.membership.role, "finance:read");
  const [customerRows, supplierRows] = await Promise.all([listRows("Customers"), listRows("Suppliers")]);
  const customer = customerRows.find((r) => r.id === v.customerId && r.tenantId === tenantId && !r.archivedAt);
  if (!customer) return Response.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 400 });
  const supplierId = v.supplierId || "", supplier = supplierId ? supplierRows.find((r) => r.id === supplierId && r.tenantId === tenantId && !r.archivedAt) : undefined;
  if (supplierId && !supplier) return Response.json({ error: "SUPPLIER_NOT_FOUND" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", ""), reference = "NHT-" + today + "-" + randomUUID().slice(0, 8).toUpperCase(), now = new Date().toISOString();
  const row = await insertRow("Reservations", {
    id: randomUUID(), tenantId, customerId: v.customerId, supplierId, supplierTenantId: supplierId ? tenantId : "", reference,
    serviceType: v.serviceType, status: "INQUIRY", startDate: v.startDate || "", endDate: v.endDate || "", currency: v.currency,
    saleAmount: v.saleAmount, costAmount: canReadCosts ? v.costAmount : "0", notes: v.notes || "", createdAt: now, updatedAt: now, archivedAt: ""
  });
  await logAudit({ tenantId, userId: access.session.user.id, action: "RESERVATION_CREATED", entityType: "Reservation", entityId: row.id, metadata: { reference } });
  return Response.json({ item: { ...row, startDate: row.startDate || null, endDate: row.endDate || null, costAmount: canReadCosts ? row.costAmount : null, notes: row.notes || null,
    customer: { id: customer.id, name: customer.name }, supplier: supplier ? { id: supplier.id, name: supplier.name } : null } }, { status: 201 });
}
