import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([dateOnly, z.literal("")]).optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const createSchema = z.object({
  customerId: z.string().trim().min(1).max(80),
  supplierId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  serviceType: z.enum(["HOTEL", "FLIGHT", "VISA", "TRANSPORT", "UMRAH_PACKAGE", "HAJJ_PACKAGE", "TOUR", "OTHER"]),
  startDate: optionalDate,
  endDate: optionalDate,
  currency: z.string().regex(/^[A-Z]{3}$/).default("EGP"),
  saleAmount: money.default("0"),
  costAmount: money.default("0"),
  notes: z.string().trim().max(2000).optional()
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate !== "" && value.endDate !== "" && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must not be earlier than start date." });
  }
});

function asDate(value: string | undefined) {
  return value ? new Date(value + "T12:00:00.000Z") : null;
}

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const requestedSize = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = Number.isInteger(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 100) : 25;
  const where = {
    tenantId: access.membership.tenantId,
    archivedAt: null,
    ...(search ? { OR: [
      { reference: { contains: search, mode: "insensitive" as const } },
      { customer: { name: { contains: search, mode: "insensitive" as const } } }
    ] } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.reservation.findMany({
      where,
      include: { customer: { select: { id: true, name: true, type: true } }, supplier: { select: { id: true, name: true, category: true } } },
      orderBy: [{ createdAt: "desc" }, { reference: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.reservation.count({ where })
  ]);
  return Response.json({
    items: items.map((item) => ({ ...item, saleAmount: item.saleAmount.toString(), costAmount: item.costAmount.toString() })),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true } });
    if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };
    const supplierId = input.supplierId || null;
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true } });
      if (!supplier) return { error: "SUPPLIER_NOT_FOUND" as const };
    }
    const reference = `NHT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await tx.reservation.create({
      data: {
        tenantId: access.membership.tenantId,
        customerId: input.customerId,
        supplierId,
        reference,
        serviceType: input.serviceType,
        status: "INQUIRY",
        startDate: asDate(input.startDate),
        endDate: asDate(input.endDate),
        currency: input.currency,
        saleAmount: input.saleAmount,
        costAmount: input.costAmount,
        notes: input.notes || null
      },
      include: { customer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } }
    });
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "RESERVATION_CREATED", entityType: "Reservation", entityId: created.id, metadata: { reference: created.reference } }
    });
    return { item: created };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ item: { ...result.item, saleAmount: result.item.saleAmount.toString(), costAmount: result.item.costAmount.toString() } }, { status: 201 });
}
