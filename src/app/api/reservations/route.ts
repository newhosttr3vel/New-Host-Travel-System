import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { runReservationTransaction } from "@/lib/reservation-errors";
import { hotelReservationDetailsSchema, normalizeHotelReservation } from "@/lib/hotel-pricing";
import type { Prisma } from "@/generated/prisma/client";

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
  notes: z.string().trim().max(2000).optional(),
  hotelDetails: hotelReservationDetailsSchema.optional()
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate !== "" && value.endDate !== "" && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must not be earlier than start date." });
  }
});

function asDate(value: string | undefined) {
  return value ? new Date(value + "T12:00:00.000Z") : null;
}

const reservationInclude = {
  customer: { select: { id: true, name: true, companyName: true, type: true, nationality: true } },
  supplier: { select: { id: true, name: true, category: true } },
  hotelDetail: {
    include: {
      rooms: {
        orderBy: { sortOrder: "asc" as const },
        include: { nightlyRates: { orderBy: { stayDate: "asc" as const } } }
      }
    }
  }
} as const satisfies Prisma.ReservationInclude;
type ReservationRecord = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

function serializeReservation(item: ReservationRecord, canReadCosts: boolean) {
  return {
    ...item,
    saleAmount: item.saleAmount.toString(),
    costAmount: canReadCosts ? item.costAmount.toString() : null,
    hotelDetail: item.hotelDetail ? {
      ...item.hotelDetail,
      rooms: item.hotelDetail.rooms.map((room) => ({
        ...room,
        nightlyRates: room.nightlyRates.map((rate) => ({
          ...rate,
          saleRoomRate: rate.saleRoomRate.toString(),
          saleMealRatePerPax: rate.saleMealRatePerPax.toString(),
          saleVat: rate.saleVat.toString(),
          costRoomRate: canReadCosts ? rate.costRoomRate.toString() : null,
          costMealRatePerPax: canReadCosts ? rate.costMealRatePerPax.toString() : null,
          costVat: canReadCosts ? rate.costVat.toString() : null,
        }))
      }))
    } : null
  };
}

function hotelDetailsCreateData(
  tenantId: string,
  hotelId: string,
  hotelName: string,
  customerNationality: string | null,
  input: NonNullable<z.infer<typeof createSchema>["hotelDetails"]>,
  pricing: ReturnType<typeof normalizeHotelReservation>,
): Prisma.HotelReservationDetailUncheckedCreateWithoutReservationInput {
  return {
    // This is the unchecked nested input selected by Reservation.create,
    // which already supplies the tenant-scoped customer/supplier scalar IDs.
    tenantId,
    hotelId,
    hotelName,
    clientNationality: input.clientNationality || customerNationality,
    guestName: input.guestName,
    guestNationality: input.guestNationality || null,
    guestPhone: input.guestPhone || null,
    rateCode: input.rateCode || null,
    clientOptionDate: input.clientOptionDate ? asDate(input.clientOptionDate) : null,
    hotelOptionDate: input.hotelOptionDate ? asDate(input.hotelOptionDate) : null,
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
        tenantId,
        roomCount: room.roomCount,
        roomType: room.roomType,
        mealPlan: room.mealPlan,
        adults: room.adults,
        children: room.children,
        sortOrder: room.sortOrder,
        nightlyRates: {
          create: room.rates.map((rate) => ({ tenantId, ...rate }))
        }
      }))
    }
  };
}

export async function GET(request: Request) {
  const access = await requireTenantPermission(request, "reservations:read");
  if (!access.ok) return access.response;
  const canReadCosts = hasPermission(access.membership.role, "finance:read");
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
      include: reservationInclude,
      orderBy: [{ createdAt: "desc" }, { reference: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.reservation.count({ where })
  ]);
  return Response.json({
    items: items.map((item) => serializeReservation(item, canReadCosts)),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  });
}

export async function POST(request: Request) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({
    error: "VALIDATION_ERROR",
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  }, { status: 400 });
  const input = parsed.data;
  const canReadCosts = hasPermission(access.membership.role, "finance:read");
  if (input.serviceType === "HOTEL" && (!input.hotelDetails || !input.startDate || !input.endDate)) {
    return Response.json({ error: "HOTEL_DETAILS_REQUIRED" }, { status: 400 });
  }
  if (input.serviceType !== "HOTEL" && input.hotelDetails) {
    return Response.json({ error: "HOTEL_DETAILS_ONLY_FOR_HOTEL" }, { status: 400 });
  }

  let hotelPricing: ReturnType<typeof normalizeHotelReservation> | null = null;
  if (input.serviceType === "HOTEL" && input.hotelDetails && input.startDate && input.endDate) {
    try {
      hotelPricing = normalizeHotelReservation(input.hotelDetails, input.startDate, input.endDate, canReadCosts);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "INVALID_HOTEL_PRICING" }, { status: 400 });
    }
  }

  const outcome = await runReservationTransaction("create", () => prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true, nationality: true, type: true } });
    if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };
    if ((input.serviceType === "HOTEL" || input.serviceType === "FLIGHT") && customer.type !== "CORPORATE") return { error: "CORPORATE_CLIENT_REQUIRED" as const };
    if (input.serviceType === "FLIGHT" && !input.supplierId) return { error: "AIRLINE_SUPPLIER_REQUIRED" as const };
    const supplierId = input.supplierId || null;
    if (input.serviceType === "HOTEL" && !supplierId) return { error: "HOTEL_SUPPLIER_REQUIRED" as const };
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId: access.membership.tenantId, archivedAt: null }, select: { id: true, name: true, category: true } });
      if (!supplier) return { error: "SUPPLIER_NOT_FOUND" as const };
      if (input.serviceType === "HOTEL" && supplier.category !== "HOTEL") return { error: "HOTEL_SUPPLIER_REQUIRED" as const };
      if (input.serviceType === "FLIGHT" && supplier.category !== "AIRLINE") return { error: "AIRLINE_SUPPLIER_REQUIRED" as const };
    }
    const hotel = input.hotelDetails
      ? await tx.hotel.findFirst({
          where: { id: input.hotelDetails.hotelId, tenantId: access.membership.tenantId, archivedAt: null },
          select: { id: true, name: true }
        })
      : null;
    if (input.hotelDetails && !hotel) return { error: "HOTEL_NOT_FOUND" as const };
    const reference = `NHT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await tx.reservation.create({
      data: {
        tenantId: access.membership.tenantId,
        customerId: input.customerId,
        supplierId,
        supplierTenantId: supplierId ? access.membership.tenantId : null,
        reference,
        serviceType: input.serviceType,
        status: "INQUIRY",
        startDate: asDate(input.startDate),
        endDate: asDate(input.endDate),
        currency: input.currency,
        saleAmount: hotelPricing?.saleAmount ?? input.saleAmount,
        costAmount: hotelPricing?.costAmount ?? (canReadCosts ? input.costAmount : "0"),
        notes: input.notes || null,
        ...(hotelPricing && input.hotelDetails ? {
          hotelDetail: { create: hotelDetailsCreateData(
            access.membership.tenantId,
            hotel!.id,
            hotel!.name,
            customer.nationality,
            input.hotelDetails,
            hotelPricing
          ) }
        } : {})
      },
      include: reservationInclude
    });
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "RESERVATION_CREATED", entityType: "Reservation", entityId: created.id, metadata: { reference: created.reference } }
    });
    return { item: created };
  }));
  if (!outcome.ok) return outcome.response;
  const result = outcome.value;
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ item: serializeReservation(result.item, canReadCosts) }, { status: 201 });
}
