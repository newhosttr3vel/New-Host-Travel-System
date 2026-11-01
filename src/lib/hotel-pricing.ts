import { z } from "zod";

const money = z.string().regex(/^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,2})?$/);
const dateOnly = z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).refine((value) => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const text = (max: number) => z.string().trim().max(max).optional().default("");

const nightlyRateSchema = z.object({
  stayDate: dateOnly,
  saleRoomRate: money.default("0.00"),
  saleMealRatePerPax: money.default("0.00"),
  saleVat: money.default("0.00"),
  costRoomRate: money.default("0.00"),
  costMealRatePerPax: money.default("0.00"),
  costVat: money.default("0.00"),
});

const roomSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  roomCount: z.number().int().min(1).max(100),
  roomType: z.string().trim().min(1).max(120),
  mealPlan: z.enum(["RO", "BB", "HB", "FB", "AI", "UAI", "OTHER"]),
  adults: z.number().int().min(0).max(200),
  children: z.number().int().min(0).max(200),
  rates: z.array(nightlyRateSchema).min(1).max(365),
}).superRefine((room, context) => {
  if (room.adults + room.children < 1) {
    context.addIssue({ code: "custom", path: ["adults"], message: "Each room group must include at least one guest." });
  }
});

export const hotelReservationDetailsSchema = z.object({
  guestName: z.string().trim().min(2).max(160),
  clientNationality: text(80),
  guestNationality: text(80),
  guestPhone: text(40),
  rateCode: text(80),
  clientOptionDate: z.union([dateOnly, z.literal("")]).optional().default(""),
  hotelOptionDate: z.union([dateOnly, z.literal("")]).optional().default(""),
  termsAndConditions: text(4000),
  generalPolicy: text(4000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  fileNo: text(80),
  reservationRemarks: text(2000),
  roomNumber: text(80),
  hotelConfirmationNumber: text(100),
  voucher: text(120),
  referenceNumber: text(120),
  detailRemarks: text(2000),
  agreementNumber: text(100),
  costCenter: text(100),
  hotelRemarks: text(2000),
  company: text(160),
  subClient: text(160),
  salesperson: text(160),
  channel: text(80),
  clientRemarks: text(2000),
  bank: text(120),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "ELECTRONIC_WALLET", "THNDR", "OTHER"]).optional().default("CASH"),
  isManualRate: z.boolean().default(false),
  pricesIncludeVat: z.boolean().default(false),
  rooms: z.array(roomSchema).min(1).max(30),
});

export type HotelReservationDetailsInput = z.infer<typeof hotelReservationDetailsSchema>;
export type HotelNightRateInput = z.infer<typeof nightlyRateSchema>;

const MAX_AMOUNT_CENTS = 99_999_999_999_999n;

function toCents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
}

function fromCents(value: bigint): string {
  if (value < 0n || value > MAX_AMOUNT_CENTS) throw new Error("HOTEL_TOTAL_OUT_OF_RANGE");
  return (value / 100n).toString() + "." + (value % 100n).toString().padStart(2, "0");
}

function dateRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T00:00:00.000Z");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error("INVALID_HOTEL_DATE_RANGE");
  }
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (nights < 1 || nights > 365) throw new Error("HOTEL_STAY_LENGTH_INVALID");
  return Array.from({ length: nights }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
}

export function normalizeHotelReservation(
  input: HotelReservationDetailsInput,
  startDate: string,
  endDate: string,
  canReadCosts: boolean,
) {
  const nights = dateRange(startDate, endDate);
  let saleTotal = 0n;
  let costTotal = 0n;
  let totalAdults = 0;
  let totalChildren = 0;
  let totalRooms = 0;
  let totalRoomNights = 0;

  const rooms = input.rooms.map((room, index) => {
    if (room.rates.length !== nights.length) throw new Error("HOTEL_NIGHT_RATES_REQUIRED");
    totalAdults += room.adults;
    totalChildren += room.children;
    totalRooms += room.roomCount;
    totalRoomNights += room.roomCount * nights.length;

    const rates = room.rates.map((rate, rateIndex) => {
      if (rate.stayDate !== nights[rateIndex]) throw new Error("HOTEL_NIGHT_RATE_DATE_MISMATCH");
      const pax = BigInt(room.adults + room.children);
      const roomQuantity = BigInt(room.roomCount);
      const salePrice = toCents(rate.saleRoomRate) * roomQuantity
        + toCents(rate.saleMealRatePerPax) * pax;
      const saleVat = toCents(rate.saleVat);
      const saleNightTotal = input.pricesIncludeVat ? salePrice : salePrice + saleVat;
      const costRoomRate = canReadCosts ? rate.costRoomRate : "0.00";
      const costMealRatePerPax = canReadCosts ? rate.costMealRatePerPax : "0.00";
      const costVat = canReadCosts ? rate.costVat : "0.00";
      const costPrice = toCents(costRoomRate) * roomQuantity
        + toCents(costMealRatePerPax) * pax;
      const costNightTotal = input.pricesIncludeVat ? costPrice : costPrice + toCents(costVat);

      saleTotal += saleNightTotal;
      costTotal += costNightTotal;
      return {
        stayDate: new Date(rate.stayDate + "T12:00:00.000Z"),
        saleRoomRate: fromCents(toCents(rate.saleRoomRate)),
        saleMealRatePerPax: fromCents(toCents(rate.saleMealRatePerPax)),
        saleVat: fromCents(saleVat),
        costRoomRate: fromCents(toCents(costRoomRate)),
        costMealRatePerPax: fromCents(toCents(costMealRatePerPax)),
        costVat: fromCents(toCents(costVat)),
      };
    });
    return { ...room, sortOrder: index, rates };
  });

  if (saleTotal > MAX_AMOUNT_CENTS || costTotal > MAX_AMOUNT_CENTS) {
    throw new Error("HOTEL_TOTAL_OUT_OF_RANGE");
  }

  return {
    nights: nights.length,
    totalAdults,
    totalChildren,
    totalPax: totalAdults + totalChildren,
    totalRooms,
    totalRoomNights,
    saleAmount: fromCents(saleTotal),
    costAmount: fromCents(costTotal),
    rooms,
  };
}

export function hotelNightCount(startDate: string, endDate: string): number {
  return dateRange(startDate, endDate).length;
}

export function calculateNightDisplay(
  room: { roomCount: number; adults: number; children: number },
  rate: Pick<HotelNightRateInput, "saleRoomRate" | "saleMealRatePerPax" | "saleVat" | "costRoomRate" | "costMealRatePerPax" | "costVat">,
  pricesIncludeVat: boolean,
  showCosts: boolean,
) {
  const rooms = BigInt(room.roomCount);
  const pax = BigInt(room.adults + room.children);
  const salePrice = toCents(rate.saleRoomRate) * rooms + toCents(rate.saleMealRatePerPax) * pax;
  const saleTotal = pricesIncludeVat ? salePrice : salePrice + toCents(rate.saleVat);
  const costPrice = toCents(showCosts ? rate.costRoomRate : "0") * rooms
    + toCents(showCosts ? rate.costMealRatePerPax : "0") * pax;
  const costTotal = pricesIncludeVat ? costPrice : costPrice + toCents(showCosts ? rate.costVat : "0");
  return {
    saleMealPrice: fromCents(toCents(rate.saleMealRatePerPax) * pax),
    salePrice: fromCents(salePrice),
    saleTotal: fromCents(saleTotal),
    costMealPrice: fromCents(showCosts ? toCents(rate.costMealRatePerPax) * pax : 0n),
    costPrice: fromCents(costPrice),
    costTotal: fromCents(costTotal),
  };
}
