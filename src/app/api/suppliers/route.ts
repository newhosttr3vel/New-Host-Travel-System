import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireTenantPermission } from "@/lib/api-auth";
import { activeRowsForTenant } from "@/lib/tenant-data";
import { insertRow, listRows, logAudit } from "@/lib/sheets-store";

const schema = z.object({
  name: z.string().trim().min(2).max(160), category: z.enum(["HOTEL", "AIRLINE", "TRANSPORT", "VISA_PROVIDER", "TOUR_OPERATOR", "OTHER"]).default("OTHER"),
  contactName: z.string().trim().max(120).optional(), email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(), paymentTerms: z.string().trim().max(500).optional(), notes: z.string().trim().max(2000).optional()
});
export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "suppliers:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url), search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
  const p = Number(url.searchParams.get("page") ?? "1"), s = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(p) && p > 0 ? Math.min(p, 100000) : 1, pageSize = Number.isInteger(s) && s > 0 ? Math.min(s, 100) : 25;
  const rows = activeRowsForTenant(await listRows("Suppliers"), access.membership.tenantId)
    .filter((r) => !search || [r.name, r.contactName, r.email, r.phone].some((v) => v.toLocaleLowerCase().includes(search)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name));
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
    ...r, contactName: r.contactName || null, email: r.email || null, phone: r.phone || null, paymentTerms: r.paymentTerms || null, notes: r.notes || null
  }));
  return Response.json({ items, pagination: { page, pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) } });
}
export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data, now = new Date().toISOString();
  const row = await insertRow("Suppliers", {
    id: randomUUID(), tenantId: access.membership.tenantId, name: input.name, category: input.category,
    contactName: input.contactName || "", email: input.email || "", phone: input.phone || "",
    paymentTerms: input.paymentTerms || "", notes: input.notes || "", createdAt: now, updatedAt: now, archivedAt: ""
  });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: row.id });
  return Response.json({ item: { ...row, contactName: row.contactName || null, email: row.email || null, phone: row.phone || null, paymentTerms: row.paymentTerms || null, notes: row.notes || null } }, { status: 201 });
}
