import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { activateTenantRequestContext, requireTenantPermission } from "@/lib/api-auth";
import { branchScopeWhere, canAccessBranch } from "@/lib/branch-access";
import { hasPermission } from "@/lib/permissions";
import { bookingFileCreateSchema, asBookingDate, type BookingFileServiceInput } from "@/lib/booking-file-create";
import { bookingFileRequestHash } from "@/lib/booking-file-idempotency";
import { normalizeHotelReservation } from "@/lib/hotel-pricing";
import { runReservationTransaction } from "@/lib/reservation-errors";
import { bookingFileViewInclude, serializeBookingFile } from "@/lib/booking-file-view";

function hotelDetailsCreateData(
  hotelId: string,
  hotelName: string,
  customerNationality: string | null,
  input: NonNullable<BookingFileServiceInput["hotelDetails"]>,
  pricing: ReturnType<typeof normalizeHotelReservation>
): Prisma.HotelReservationDetailUncheckedCreateWithoutReservationInput {
  return {
    // Reservation.create supplies tenantId through the parent relation.
    hotelId,
    hotelName,
    clientNationality: input.clientNationality || customerNationality,
    guestName: input.guestName,
    guestNationality: input.guestNationality || null,
    guestPhone: input.guestPhone || null,
    rateCode: input.rateCode || null,
    clientOptionDate: input.clientOptionDate ? asBookingDate(input.clientOptionDate) : null,
    hotelOptionDate: input.hotelOptionDate ? asBookingDate(input.hotelOptionDate) : null,
    termsAndConditions: input.termsAndConditions || null,
    generalPolicy: input.generalPolicy || null,
    tags: input.tags,
    fileNo: input.fileNo || null,
    reservationRemarks: input.reservationRemarks || null,
    roomNumber: input.roomNumber || null,
    hotelConfirmationNumber: input.hotelConfirmationNumber || null,
    voucher: input.voucher || null,
    referenceNumber: input.referenceNumber || null,
    detailRemarks: input.detailRemarks || null,
    agreementNumber: input.agreementNumber || null,
    costCenter: input.costCenter || null,
    hotelRemarks: input.hotelRemarks || null,
    company: input.company || null,
    subClient: input.subClient || null,
    salesperson: input.salesperson || null,
    channel: input.channel || null,
    clientRemarks: input.clientRemarks || null,
    bank: input.bank || null,
    paymentMethod: input.paymentMethod || "CASH",
    isManualRate: input.isManualRate,
    pricesIncludeVat: input.pricesIncludeVat,
    rooms: {
      create: pricing.rooms.map((room) => ({
        roomCount: room.roomCount,
        roomType: room.roomType,
        mealPlan: room.mealPlan,
        adults: room.adults,
        children: room.children,
        sortOrder: room.sortOrder,
        nightlyRates: {
          create: room.rates.map((rate) => ({ ...rate }))
        }
      }))
    }
  };
}

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

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  activateTenantRequestContext(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = bookingFileCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      error: "VALIDATION_ERROR",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    }, { status: 400 });
  }

  const input = parsed.data;
  const requestHash = bookingFileRequestHash(input);
  const canReadCosts = hasPermission(access.membership.role, "finance:read");
  const preparedServices: Array<{
    service: BookingFileServiceInput;
    hotelPricing: ReturnType<typeof normalizeHotelReservation> | null;
  }> = [];
  let totalHotelRoomNights = 0;

  for (const service of input.services) {
    let hotelPricing: ReturnType<typeof normalizeHotelReservation> | null = null;
    if (service.serviceType === "HOTEL" && service.hotelDetails && service.startDate && service.endDate) {
      try {
        hotelPricing = normalizeHotelReservation(service.hotelDetails, service.startDate, service.endDate, canReadCosts);
      } catch (error) {
        return Response.json({
          error: error instanceof Error ? error.message : "INVALID_HOTEL_PRICING"
        }, { status: 400 });
      }
    }
    if (hotelPricing) {
      totalHotelRoomNights += hotelPricing.totalRoomNights;
      if (totalHotelRoomNights > 3650) {
        return Response.json({ error: "BOOKING_FILE_HOTEL_ROOM_NIGHT_LIMIT_EXCEEDED" }, { status: 400 });
      }
    }
    preparedServices.push({ service, hotelPricing });
  }

  const outcome = await runReservationTransaction("create-booking-file", () => prisma.$transaction(async (tx) => {
    const tenantId = access.membership.tenantId;
    const lockKey = `booking-file:${tenantId}:${input.idempotencyKey}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const previous = await tx.bookingFile.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
      include: bookingFileViewInclude
    });
    if (previous) {
      if (!previous.branchId || !canAccessBranch(access.membership, previous.branchId)) {
        return { error: "IDEMPOTENCY_KEY_SCOPE_CONFLICT" as const };
      }
      if (previous.requestHash !== requestHash) return { error: "IDEMPOTENCY_KEY_REUSED" as const };
      return { item: previous, replay: true as const };
    }

    const assignedBranchIds = access.membership.branchAssignments.map((item) => item.branchId);
    const isAdministrator = access.membership.role === "OWNER" || access.membership.role === "ADMINISTRATOR";
    const requestedBranchId = input.branchId ?? (isAdministrator ? undefined : assignedBranchIds[0]);
    const branch = requestedBranchId
      ? await tx.branch.findFirst({
          where: { id: requestedBranchId, tenantId: access.membership.tenantId, isActive: true },
          select: { id: true }
        })
      : await tx.branch.findFirst({
          where: { tenantId: access.membership.tenantId, slug: "main", isActive: true },
          select: { id: true }
        });

    if (!branch) return { error: "BRANCH_NOT_FOUND" as const };
    if (!canAccessBranch(access.membership, branch.id)) return { error: "BRANCH_NOT_ASSIGNED" as const };

    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, tenantId: access.membership.tenantId, archivedAt: null },
      select: { id: true, nationality: true, type: true }
    });
    if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };
    if (
      preparedServices.some(({ service }) => service.serviceType === "HOTEL" || service.serviceType === "FLIGHT") &&
      customer.type !== "CORPORATE"
    ) {
      return { error: "CORPORATE_CLIENT_REQUIRED" as const };
    }

    const supplierIds = [...new Set(preparedServices
      .map(({ service }) => service.supplierId)
      .filter((id): id is string => Boolean(id)))];
    const suppliers = supplierIds.length
      ? await tx.supplier.findMany({
          where: { id: { in: supplierIds }, tenantId: access.membership.tenantId, archivedAt: null },
          select: { id: true, name: true, category: true }
        })
      : [];
    const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

    for (const { service } of preparedServices) {
      const supplierId = service.supplierId || null;
      if (supplierId && !suppliersById.has(supplierId)) return { error: "SUPPLIER_NOT_FOUND" as const };
      const supplier = supplierId ? suppliersById.get(supplierId) : null;
      if (service.serviceType === "HOTEL" && supplier?.category !== "HOTEL") {
        return { error: "HOTEL_SUPPLIER_REQUIRED" as const };
      }
      if (service.serviceType === "FLIGHT" && supplier?.category !== "AIRLINE") {
        return { error: "AIRLINE_SUPPLIER_REQUIRED" as const };
      }
    }

    const hotelIds = [...new Set(preparedServices.flatMap(({ service }) =>
      service.hotelDetails ? [service.hotelDetails.hotelId] : []
    ))];
    const hotels = hotelIds.length
      ? await tx.hotel.findMany({
          where: { id: { in: hotelIds }, tenantId: access.membership.tenantId, archivedAt: null },
          select: { id: true, name: true }
        })
      : [];
    const hotelsById = new Map(hotels.map((hotel) => [hotel.id, hotel]));

    for (const { service } of preparedServices) {
      if (service.hotelDetails && !hotelsById.has(service.hotelDetails.hotelId)) {
        return { error: "HOTEL_NOT_FOUND" as const };
      }
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const bookingFileReference = "NHT-BF-" + dateStamp + "-" + randomUUID().slice(0, 8).toUpperCase();
    const bookingFile = await tx.bookingFile.create({
      data: {
        tenantId: access.membership.tenantId,
        branchId: branch.id,
        customerId: customer.id,
        reference: bookingFileReference,
        idempotencyKey: input.idempotencyKey,
        requestHash
      },
      select: { id: true, reference: true }
    });

    for (const { service, hotelPricing } of preparedServices) {
      const supplierId = service.supplierId || null;
      const hotel = service.hotelDetails ? hotelsById.get(service.hotelDetails.hotelId) : null;
      const reference = "NHT-" + dateStamp + "-" + randomUUID().slice(0, 8).toUpperCase();
      const created = await tx.reservation.create({
        data: {
          tenantId: access.membership.tenantId,
          branchId: branch.id,
          customerId: customer.id,
          supplierId,
          supplierTenantId: supplierId ? access.membership.tenantId : null,
          bookingFileId: bookingFile.id,
          reference,
          serviceType: service.serviceType,
          status: "INQUIRY",
          startDate: asBookingDate(service.startDate),
          endDate: asBookingDate(service.endDate),
          currency: service.currency,
          saleAmount: hotelPricing?.saleAmount ?? service.saleAmount,
          costAmount: hotelPricing?.costAmount ?? (canReadCosts ? service.costAmount : "0"),
          notes: service.notes || null,
          ...(hotelPricing && service.hotelDetails && hotel ? {
            hotelDetail: {
              create: hotelDetailsCreateData(
                hotel.id,
                hotel.name,
                customer.nationality,
                service.hotelDetails,
                hotelPricing
              )
            }
          } : {})
        },
        select: { id: true, reference: true }
      });

      await tx.auditEvent.create({
        data: {
          tenantId: access.membership.tenantId,
          userId: access.session.user.id,
          action: "RESERVATION_CREATED",
          entityType: "Reservation",
          entityId: created.id,
          metadata: { reference: created.reference, bookingFileId: bookingFile.id }
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        tenantId: access.membership.tenantId,
        userId: access.session.user.id,
        action: "BOOKING_FILE_CREATED",
        entityType: "BookingFile",
        entityId: bookingFile.id,
        metadata: {
          reference: bookingFile.reference,
          customerId: customer.id,
          serviceCount: preparedServices.length
        }
      }
    });

    const item = await tx.bookingFile.findFirst({
      where: { id: bookingFile.id, tenantId: access.membership.tenantId, branchId: branch.id },
      include: bookingFileViewInclude
    });
    if (!item) throw new Error("CREATED_BOOKING_FILE_NOT_FOUND");
    return { item, replay: false as const };
  }));

  if (!outcome.ok) return outcome.response;
  const result = outcome.value;
  if ("error" in result) {
    const isConflict = result.error === "IDEMPOTENCY_KEY_REUSED" || result.error === "IDEMPOTENCY_KEY_SCOPE_CONFLICT";
    return Response.json(
      { error: result.error },
      { status: result.error === "BRANCH_NOT_ASSIGNED" ? 403 : isConflict ? 409 : 400 }
    );
  }

  return Response.json(
    { item: serializeBookingFile(result.item, canReadCosts), replay: result.replay },
    { status: result.replay ? 200 : 201 }
  );
}
