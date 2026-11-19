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
      createdAt: true
    },
    orderBy: [{ createdAt: "asc" }, { reference: "asc" }]
  }
} as const satisfies Prisma.BookingFileInclude;

export type BookingFileView = Prisma.BookingFileGetPayload<{
  include: typeof bookingFileViewInclude;
}>;

type DecimalLike = { toString(): string };

export function serializeBookingFile<
  T extends {
    reservations: Array<{
      saleAmount: DecimalLike;
      costAmount: DecimalLike;
    }>;
  }
>(item: T, canReadCosts: boolean) {
  return {
    ...item,
    reservations: item.reservations.map((reservation) => ({
      ...reservation,
      saleAmount: reservation.saleAmount.toString(),
      costAmount: canReadCosts ? reservation.costAmount.toString() : null
    }))
  };
}
