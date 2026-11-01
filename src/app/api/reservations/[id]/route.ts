import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantPermission } from "@/lib/api-auth";
import { canTransitionReservationStatus } from "@/lib/reservation-workflow";
import { hasPermission } from "@/lib/permissions";
import { runReservationTransaction } from "@/lib/reservation-errors";
import { hotelReservationDetailsSchema, normalizeHotelReservation, restorePersistedHotelCosts } from "@/lib/hotel-pricing";
import type { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([dateOnly, z.literal("")]).optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const patchSchema = z.object({
  customerId: z.string().trim().min(1).max(80).optional(),
  supplierId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  serviceType: z.enum(["HOTEL", "FLIGHT", "VISA", "TRANSPORT", "UMRAH_PACKAGE", "HAJJ_PACKAGE", "TOUR", "OTHER"]).optional(),
  status: z.enum(["INQUIRY", "QUOTATION", "PENDING", "ON_HOLD", "CONFIRMED", "PARTIALLY_PAID", "FULLY_PAID", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  saleAmount: money.optional(),
  costAmount: money.optional(),
  notes: z.string().trim().max(2000).optional(),
  hotelDetails: hotelReservationDetailsSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

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

function asDate(value: string | undefined) {
  return value === undefined ? undefined : value ? new Date(value + "T12:00:00.000Z") : null;
}

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

function hotelDetailsData(
  tenantId: string,
  hotelId: string,
  hotelName: string,
  clientNationality: string | null,
  input: z.infer<typeof hotelReservationDetailsSchema>,
  pricing: ReturnType<typeof normalizeHotelReservation>,
) {
  return {
    tenantId,
    hotelId,
    hotelName,
    clientNationality: input.clientNationality || clientNationality,
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

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const canReadCosts = hasPermission(access.membership.role, "finance:read");

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
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
  if (!canReadCosts && input.costAmount !== undefined) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const outcome = await runReservationTransaction("update", () => prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      include: {
        hotelDetail: {
          include: { rooms: { include: { nightlyRates: true } } }
        }
      }
    });
    if (!existing) return { error: "NOT_FOUND" as const };
    if (input.status && !canTransitionReservationStatus(existing.status, input.status)) {
      return { error: "INVALID_STATUS_TRANSITION" as const, currentStatus: existing.status };
    }

    const startDate = asDate(input.startDate) === undefined ? existing.startDate : asDate(input.startDate);
    const endDate = asDate(input.endDate) === undefined ? existing.endDate : asDate(input.endDate);
    if (startDate && endDate && endDate < startDate) return { error: "INVALID_DATE_RANGE" as const };

    const customerId = input.customerId ?? existing.customerId;
    const effectiveServiceType = input.serviceType ?? existing.serviceType;
    const customer = await tx.customer.findFirst({
      where: { id: customerId, tenantId: access.membership.tenantId, archivedAt: null },
      select: { id: true, nationality: true, type: true }
    });
    if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };
    if ((effectiveServiceType === "HOTEL" || effectiveServiceType === "FLIGHT") && customer.type !== "CORPORATE") return { error: "CORPORATE_CLIENT_REQUIRED" as const };

    const supplierId = input.supplierId === undefined ? existing.supplierId : (input.supplierId || null);
    const supplier = supplierId
      ? await tx.supplier.findFirst({
          where: { id: supplierId, tenantId: access.membership.tenantId, archivedAt: null },
          select: { id: true, name: true, category: true }
        })
      : null;
    if (supplierId && !supplier) return { error: "SUPPLIER_NOT_FOUND" as const };

    const selectedHotel = input.hotelDetails
      ? await tx.hotel.findFirst({
          where: { id: input.hotelDetails.hotelId, tenantId: access.membership.tenantId, archivedAt: null },
          select: { id: true, name: true }
        })
      : null;
    if (input.hotelDetails && !selectedHotel) return { error: "HOTEL_NOT_FOUND" as const };

    if (input.hotelDetails && effectiveServiceType !== "HOTEL") {
      return { error: "HOTEL_DETAILS_ONLY_FOR_HOTEL" as const };
    }
    if (effectiveServiceType === "HOTEL" && (!supplierId || supplier?.category !== "HOTEL")) {
      return { error: "HOTEL_SUPPLIER_REQUIRED" as const };
    }
    if (effectiveServiceType === "FLIGHT" && (!supplierId || supplier?.category !== "AIRLINE")) {
      return { error: "AIRLINE_SUPPLIER_REQUIRED" as const };
    }
    if (
      effectiveServiceType === "HOTEL" &&
      (input.serviceType === "HOTEL" || input.startDate !== undefined || input.endDate !== undefined) &&
      !input.hotelDetails
    ) {
      return { error: "HOTEL_DETAILS_REQUIRED" as const };
    }

    let hotelPricing: ReturnType<typeof normalizeHotelReservation> | null = null;
    if (input.hotelDetails) {
      const startText = input.startDate !== undefined ? input.startDate : existing.startDate?.toISOString().slice(0, 10) ?? "";
      const endText = input.endDate !== undefined ? input.endDate : existing.endDate?.toISOString().slice(0, 10) ?? "";
      if (!startText || !endText) return { error: "HOTEL_DATES_REQUIRED" as const };
      try {
        const detailsForPricing = canReadCosts
          ? input.hotelDetails
          : restorePersistedHotelCosts(input.hotelDetails, existing.hotelDetail?.rooms ?? []);
        // Cost values for non-finance users are restored from this reservation's persisted room IDs,
        // never accepted from the request body.
        hotelPricing = normalizeHotelReservation(detailsForPricing, startText, endText, true);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "INVALID_HOTEL_PRICING" };
      }
    }

    const data = {
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null, supplierTenantId: input.supplierId ? access.membership.tenantId : null } : {}),
      ...(input.serviceType !== undefined ? { serviceType: input.serviceType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: asDate(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: asDate(input.endDate) } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.saleAmount !== undefined ? { saleAmount: input.saleAmount } : {}),
      ...(input.costAmount !== undefined ? { costAmount: input.costAmount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(hotelPricing ? { saleAmount: hotelPricing.saleAmount, costAmount: hotelPricing.costAmount } : {})
    };

    const update = await tx.reservation.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null, updatedAt: existing.updatedAt, status: existing.status },
      data
    });
    if (update.count !== 1) return { error: "CONFLICT" as const };

    if (input.hotelDetails && hotelPricing && customer) {
      const createData = hotelDetailsData(
        access.membership.tenantId,
        selectedHotel!.id,
        selectedHotel!.name,
        customer.nationality,
        input.hotelDetails,
        hotelPricing
      );
      const { rooms, ...detailFields } = createData;
      await tx.hotelReservationDetail.upsert({
        where: { reservationId_tenantId: { reservationId: id, tenantId: access.membership.tenantId } },
        create: { reservationId: id, ...createData },
        update: {
          ...detailFields,
          rooms: { deleteMany: {}, create: rooms.create },
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        tenantId: access.membership.tenantId,
        userId: access.session.user.id,
        action: input.status && input.status !== existing.status ? "RESERVATION_STATUS_CHANGED" : input.hotelDetails ? "HOTEL_RESERVATION_UPDATED" : "RESERVATION_UPDATED",
        entityType: "Reservation",
        entityId: id,
        metadata: { previousStatus: existing.status, nextStatus: input.status ?? existing.status, hotelDetailsUpdated: Boolean(input.hotelDetails) }
      }
    });

    const item = await tx.reservation.findFirst({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      include: reservationInclude
    });
    return { item };
  }));
  if (!outcome.ok) return outcome.response;
  const result = outcome.value;

  if ("error" in result) {
    const statusCode =
      result.error === "NOT_FOUND" ? 404 :
      result.error === "INVALID_STATUS_TRANSITION" || result.error === "CONFLICT" ? 409 : 400;
    return Response.json({ error: result.error, ...("currentStatus" in result ? { currentStatus: result.currentStatus } : {}) }, { status: statusCode });
  }
  if (!result.item) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ item: serializeReservation(result.item, canReadCosts) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireTenantPermission(request, "reservations:write");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.updateMany({
      where: { id, tenantId: access.membership.tenantId, archivedAt: null },
      data: { archivedAt: new Date() }
    });
    if (updated.count !== 1) return false;
    await tx.auditEvent.create({
      data: { tenantId: access.membership.tenantId, userId: access.session.user.id, action: "RESERVATION_ARCHIVED", entityType: "Reservation", entityId: id }
    });
    return true;
  });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
