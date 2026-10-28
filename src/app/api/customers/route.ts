import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireTenantPermission } from "@/lib/api-auth";
import { activeRowsForTenant } from "@/lib/tenant-data";
import { insertRow, listRows, logAudit } from "@/lib/sheets-store";

const schema = z.object({
  name: z.string().trim().min(2).max(160), type: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
  companyName: z.string().trim().max(160).optional(), email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(), notes: z.string().trim().max(2000).optional()
});
export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "customers:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url), search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase();
  const p = Number(url.searchParams.get("page") ?? "1"), s = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(p) && p > 0 ? Math.min(p, 100000) : 1, pageSize = Number.isInteger(s) && s > 0 ? Math.min(s, 100) : 25;
  const rows = activeRowsForTenant(await listRows("Customers"), access.membership.tenantId)
    .filter((r) => !search || [r.name, r.email, r.phone, r.companyName].some((v) => v.toLocaleLowerCase().includes(search)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name));
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
    id: r.id, type: r.type || "INDIVIDUAL", name: r.name, companyName: r.companyName || null, email: r.email || null,
    phone: r.phone || null, notes: r.notes || null, createdAt: r.createdAt, updatedAt: r.updatedAt
  }));
  return Response.json({ items, pagination: { page, pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) } });
}
export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "customers:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data, now = new Date().toISOString();
  const row = await insertRow("Customers", {
    id: randomUUID(), tenantId: access.membership.tenantId, type: input.type, name: input.name,
    companyName: input.companyName || "", email: input.email || "", phone: input.phone || "", nationality: "",
    notes: input.notes || "", createdAt: now, updatedAt: now, archivedAt: ""
  });
  await logAudit({ tenantId: access.membership.tenantId, userId: access.session.user.id, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: row.id });
  return Response.json({ item: { ...row, companyName: row.companyName || null, email: row.email || null, phone: row.phone || null, notes: row.notes || null } }, { status: 201 });
}
