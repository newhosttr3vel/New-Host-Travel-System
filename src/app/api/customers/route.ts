import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
  companyName: z.string().trim().max(160).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional()
});

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "customers:read");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const requestedSize = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = Number.isInteger(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 100) : 25;
  const where = {
    tenantId: access.membership.tenantId,
    archivedAt: null,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
        { companyName: { contains: search, mode: "insensitive" as const } }
      ]
    } : {})
  };

  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      select: { id: true, type: true, name: true, companyName: true, email: true, phone: true, notes: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.customer.count({ where })
  ]);
  return Response.json({ items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "customers:write");
  if (!access.ok) return access.response;

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        tenantId: access.membership.tenantId,
        name: input.name,
        type: input.type,
        companyName: input.companyName || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null
      },
      select: { id: true, type: true, name: true, companyName: true, email: true, phone: true, createdAt: true, updatedAt: true }
    });
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: created.id }
    });
    return created;
  });
  return Response.json({ item: customer }, { status: 201 });
}
