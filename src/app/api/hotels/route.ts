import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission, activateTenantRequestContext } from "@/lib/api-auth";

const hotelSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional()
});

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "suppliers:read");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const requestedSize = Number(url.searchParams.get("pageSize") ?? "100");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = Number.isInteger(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 100) : 100;
  const where = {
    tenantId: access.membership.tenantId,
    archivedAt: null,
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { city: { contains: search, mode: "insensitive" as const } },
      { country: { contains: search, mode: "insensitive" as const } }
    ] } : {})
  };
  const [items, total] = await prisma.$transaction(async (tx) => Promise.all([
tx.hotel.findMany({
      where,
      select: { id: true, name: true, city: true, country: true, notes: true, createdAt: true, updatedAt: true },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    tx.hotel.count({ where })
]));
  return Response.json({ items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "suppliers:write");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = hotelSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  try {
    const hotel = await prisma.$transaction(async (tx) => {
      const created = await tx.hotel.create({
        data: {
          tenantId: access.membership.tenantId,
          name: input.name,
          city: input.city || null,
          country: input.country || null,
          notes: input.notes || null
        },
        select: { id: true, name: true, city: true, country: true, notes: true, createdAt: true, updatedAt: true }
      });
      await tx.auditEvent.create({
        data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "HOTEL_CREATED", entityType: "Hotel", entityId: created.id }
      });
      return created;
    });
    return Response.json({ item: hotel }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json({ error: "HOTEL_NAME_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
