import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.enum(["HOTEL", "AIRLINE", "TRANSPORT", "VISA_PROVIDER", "TOUR_OPERATOR", "OTHER"]).default("OTHER"),
  contactName: z.string().trim().max(120).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional()
});

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "suppliers:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
  const p = Number(url.searchParams.get("page") ?? "1");
  const s = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(p) && p > 0 ? Math.min(p, 100000) : 1;
  const pageSize = Number.isInteger(s) && s > 0 ? Math.min(s, 100) : 25;
  const where = {
    tenantId: access.membership.tenantId,
    archivedAt: null,
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { contactName: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
      { phone: { contains: search, mode: "insensitive" as const } }
    ] } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.supplier.findMany({
      where,
      select: { id: true, name: true, category: true, contactName: true, email: true, phone: true, paymentTerms: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.supplier.count({ where })
  ]);
  return Response.json({ items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: {
        tenantId: access.membership.tenantId,
        name: input.name,
        category: input.category,
        contactName: input.contactName || null,
        email: input.email || null,
        phone: input.phone || null,
        paymentTerms: input.paymentTerms || null,
        notes: input.notes || null
      },
      select: { id: true, name: true, category: true, contactName: true, email: true, phone: true, paymentTerms: true, createdAt: true, updatedAt: true }
    });
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: created.id }
    });
    return created;
  });
  return Response.json({ item: supplier }, { status: 201 });
}
