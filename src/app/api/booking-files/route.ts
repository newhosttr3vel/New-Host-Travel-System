import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { activateTenantRequestContext, requireTenantPermission } from "@/lib/api-auth";
import { branchScopeWhere } from "@/lib/branch-access";
import { hasPermission } from "@/lib/permissions";
import { bookingFileViewInclude, serializeBookingFile } from "@/lib/booking-file-view";

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const customerIdInput = url.searchParams.get("customerId");
  const customerId = customerIdInput
    ? z.string().trim().min(1).max(80).safeParse(customerIdInput)
    : null;
  if (customerId && !customerId.success) {
    return Response.json({ error: "INVALID_CUSTOMER_ID" }, { status: 400 });
  }

  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const requestedSize = Number(url.searchParams.get("pageSize") ?? "25");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = Number.isInteger(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 100) : 25;

  const where: Prisma.BookingFileWhereInput = {
    tenantId: access.membership.tenantId,
    archivedAt: null,
    ...branchScopeWhere(access.membership),
    ...(customerId?.success ? { customerId: customerId.data } : {}),
    ...(search ? {
      OR: [
        { reference: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } }
      ]
    } : {})
  };

  const [items, total] = await prisma.$transaction(async (tx) => Promise.all([
    tx.bookingFile.findMany({
      where,
      include: bookingFileViewInclude,
      orderBy: [{ createdAt: "desc" }, { reference: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    tx.bookingFile.count({ where })
  ]));

  const canReadCosts = hasPermission(access.membership.role, "finance:read");
  return Response.json({
    items: items.map((item) => serializeBookingFile(item, canReadCosts)),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  });
}
