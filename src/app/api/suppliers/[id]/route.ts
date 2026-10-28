import { z } from "zod";
import { requireTenantPermission } from "@/lib/api-auth";
import { updateRow, logAudit } from "@/lib/sheets-store";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(), category: z.enum(["HOTEL", "AIRLINE", "TRANSPORT", "VISA_PROVIDER", "TOUR_OPERATOR", "OTHER"]).optional(),
  contactName: z.string().trim().max(120).optional(), email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(), paymentTerms: z.string().trim().max(500).optional(), notes: z.string().trim().max(2000).optional()
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });
export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data, now = new Date().toISOString();
  const result = await updateRow("Suppliers", (r) => r.id === id && r.tenantId === access.membership.tenantId && !r.archivedAt, {
    ...(input.name !== undefined ? { name: input.name } : {}), ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.contactName !== undefined ? { contactName: input.contactName || "" } : {}), ...(input.email !== undefined ? { email: input.email || "" } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || "" } : {}), ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms || "" } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || "" } : {}), updatedAt: now
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "SUPPLIER_UPDATED", entityType: "Supplier", entityId: id });
  return Response.json({ item: { ...result, contactName: result.contactName || null, email: result.email || null, phone: result.phone || null, paymentTerms: result.paymentTerms || null, notes: result.notes || null } });
}
export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  const { id } = await context.params, now = new Date().toISOString();
  const result = await updateRow("Suppliers", (r) => r.id === id && r.tenantId === access.membership.tenantId && !r.archivedAt, { archivedAt: now, updatedAt: now });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "SUPPLIER_ARCHIVED", entityType: "Supplier", entityId: id });
  return Response.json({ ok: true });
}
