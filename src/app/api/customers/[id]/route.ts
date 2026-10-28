import { z } from "zod";
import { requireTenantPermission } from "@/lib/api-auth";
import { updateRow, logAudit } from "@/lib/sheets-store";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(), type: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
  companyName: z.string().trim().max(160).optional(), email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(), notes: z.string().trim().max(2000).optional()
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });
export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "customers:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data, now = new Date().toISOString();
  const result = await updateRow("Customers", (r) => r.id === id && r.tenantId === access.membership.tenantId && !r.archivedAt, {
    ...(input.name !== undefined ? { name: input.name } : {}), ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.companyName !== undefined ? { companyName: input.companyName || "" } : {}), ...(input.email !== undefined ? { email: input.email || "" } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || "" } : {}), ...(input.notes !== undefined ? { notes: input.notes || "" } : {}), updatedAt: now
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "CUSTOMER_UPDATED", entityType: "Customer", entityId: id });
  return Response.json({ item: { ...result, companyName: result.companyName || null, email: result.email || null, phone: result.phone || null, notes: result.notes || null } });
}
export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "customers:archive");
  if (!access.ok) return access.response;
  const { id } = await context.params, now = new Date().toISOString();
  const result = await updateRow("Customers", (r) => r.id === id && r.tenantId === access.membership.tenantId && !r.archivedAt, { archivedAt: now, updatedAt: now });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "CUSTOMER_ARCHIVED", entityType: "Customer", entityId: id });
  return Response.json({ ok: true });
}
