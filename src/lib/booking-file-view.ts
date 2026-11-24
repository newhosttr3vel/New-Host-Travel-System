import type { Prisma } from "@/generated/prisma/client";

export const bookingFileViewInclude = {
  customer: {
    select: { id: true, type: true, name: true, companyName: true }
  },
  reservations: {
    where: { archivedAt: null },
    select: {
      id: true,
      reference: true,
      serviceType: true,
      status: true,
      startDate: true,
      endDate: true,
      currency: true,
      saleAmount: true,
      costAmount: true,
      createdAt: true,
      flightDetail: {
        select: {
          id: true,
          bookingReference: true,
          ticketingDeadline: true,
          segments: {
            orderBy: [{ segmentOrder: "asc" }],
            select: {
              id: true,
              segmentOrder: true,
              carrierCode: true,
              flightNumber: true,
              originCode: true,
              destinationCode: true,
              departureAt: true,
              arrivalAt: true,
              cabinClass: true,
              baggageAllowance: true
            }
          },
          passengers: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              fullName: true,
              passengerType: true,
              nationality: true,
              ticketNumber: true,
              ticketStatus: true
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: "asc" }, { reference: "asc" }]
  }
} as const satisfies Prisma.BookingFileInclude;

export type BookingFileView = Prisma.BookingFileGetPayload<{
  include: typeof bookingFileViewInclude;
}>;

type DecimalLike = { toString(): string };

type FlightDetailProjection = {
  bookingReference: string | null;
  passengers: Array<{
    nationality: string | null;
    ticketNumber: string | null;
  }>;
};

export function serializeBookingFile<
  T extends {
    reservations: Array<{
      saleAmount: DecimalLike;
      costAmount: DecimalLike;
      flightDetail?: FlightDetailProjection | null;
    }>;
  }
>(item: T, canReadCosts: boolean, canReadTravelDocuments = false) {
  return {
    ...item,
    reservations: item.reservations.map((reservation) => ({
      ...reservation,
      saleAmount: reservation.saleAmount.toString(),
      costAmount: canReadCosts ? reservation.costAmount.toString() : null,
      flightDetail: reservation.flightDetail ? {
        ...reservation.flightDetail,
        bookingReference: canReadTravelDocuments ? reservation.flightDetail.bookingReference : null,
        passengers: reservation.flightDetail.passengers.map((passenger) => ({
          ...passenger,
          nationality: canReadTravelDocuments ? passenger.nationality : null,
          ticketNumber: canReadTravelDocuments ? passenger.ticketNumber : null
        }))
      } : reservation.flightDetail ?? null
    }))
  };
}
