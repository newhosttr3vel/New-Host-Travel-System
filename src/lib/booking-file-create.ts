import { z } from "zod";
import { hotelReservationDetailsSchema } from "@/lib/hotel-pricing";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([dateOnly, z.literal("")]).optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const flightDateTime = z.string().datetime({ offset: true });

const flightSegmentSchema = z.object({
  carrierCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,3}$/),
  flightNumber: z.string().trim().toUpperCase().regex(/^\d{1,4}[A-Z]?$/),
  originCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  destinationCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  departureAt: flightDateTime,
  arrivalAt: flightDateTime,
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
  baggageAllowance: z.string().trim().max(80).optional()
}).superRefine((value, context) => {
  if (Date.parse(value.arrivalAt) <= Date.parse(value.departureAt)) {
    context.addIssue({ code: "custom", path: ["arrivalAt"], message: "Arrival must be later than departure." });
  }
});

const flightPassengerSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  passengerType: z.enum(["ADULT", "CHILD", "INFANT"]).default("ADULT"),
  nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  ticketNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{5,32}$/).optional(),
  ticketStatus: z.enum(["PENDING", "ISSUED", "VOIDED"]).default("PENDING")
}).superRefine((value, context) => {
  if (value.ticketStatus === "ISSUED" && !value.ticketNumber) {
    context.addIssue({ code: "custom", path: ["ticketNumber"], message: "An issued ticket must have a ticket number." });
  }
});

export const flightReservationDetailsSchema = z.object({
  bookingReference: z.string().trim().toUpperCase().max(12).optional(),
  ticketingDeadline: flightDateTime.optional(),
  segments: z.array(flightSegmentSchema).min(1).max(12),
  passengers: z.array(flightPassengerSchema).min(1).max(20)
}).superRefine((value, context) => {
  for (let index = 1; index < value.segments.length; index += 1) {
    const previous = value.segments[index - 1];
    const current = value.segments[index];
    if (previous && current && Date.parse(current.departureAt) < Date.parse(previous.arrivalAt)) {
      context.addIssue({
        code: "custom",
        path: ["segments", index, "departureAt"],
        message: "Flight segments must be in chronological order without overlap."
      });
    }
  }
  const ticketNumbers = value.passengers
    .map((passenger) => passenger.ticketNumber)
    .filter((ticketNumber): ticketNumber is string => Boolean(ticketNumber));
  if (new Set(ticketNumbers).size !== ticketNumbers.length) {
    context.addIssue({ code: "custom", path: ["passengers"], message: "Ticket numbers must be unique within the flight booking." });
  }
});

const visaApplicantSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  dateOfBirth: dateOnly.optional()
});

export const visaReservationDetailsSchema = z.object({
  destinationCountryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  visaType: z.string().trim().min(2).max(80),
  entryType: z.enum(["SINGLE", "DOUBLE", "MULTIPLE"]).default("SINGLE"),
  applicationReference: z.string().trim().max(80).optional(),
  stayDurationDays: z.number().int().min(1).max(365).optional(),
  applicants: z.array(visaApplicantSchema).min(1).max(20)
}).strict();

const pilgrimagePackageTravellerSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  travellerType: z.enum(["ADULT", "CHILD", "INFANT"]).default("ADULT"),
  nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional()
});

export const pilgrimagePackageDetailsSchema = z.object({
  packageName: z.string().trim().min(2).max(160),
  departureCity: z.string().trim().min(2).max(100),
  departureDate: dateOnly,
  returnDate: dateOnly,
  groupReference: z.string().trim().max(80).optional(),
  accommodationLevel: z.enum(["THREE_STAR", "FOUR_STAR", "FIVE_STAR", "LUXURY", "OTHER"]).default("FOUR_STAR"),
  mealPlan: z.enum(["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"]).default("BREAKFAST"),
  transportIncluded: z.boolean().default(false),
  includedServices: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  travellers: z.array(pilgrimagePackageTravellerSchema).min(1).max(50)
}).superRefine((value, context) => {
  if (value.returnDate <= value.departureDate) {
    context.addIssue({
      code: "custom",
      path: ["returnDate"],
      message: "Return date must be later than departure date."
    });
  }
});

export const bookingFileServiceSchema = z.object({
  supplierId: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
  serviceType: z.enum(["HOTEL", "FLIGHT", "VISA", "TRANSPORT", "UMRAH_PACKAGE", "HAJJ_PACKAGE", "TOUR", "OTHER"]),
  startDate: optionalDate,
  endDate: optionalDate,
  currency: z.string().regex(/^[A-Z]{3}$/).default("EGP"),
  saleAmount: money.default("0"),
  costAmount: money.default("0"),
  notes: z.string().trim().max(2000).optional(),
  hotelDetails: hotelReservationDetailsSchema.optional(),
  flightDetails: flightReservationDetailsSchema.optional(),
  visaDetails: visaReservationDetailsSchema.optional(),
  packageDetails: pilgrimagePackageDetailsSchema.optional()
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate !== "" && value.endDate !== "" && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must not be earlier than start date." });
  }
  if (value.serviceType === "HOTEL") {
    if (!value.hotelDetails || !value.startDate || !value.endDate) {
      context.addIssue({ code: "custom", path: ["hotelDetails"], message: "Hotel details and stay dates are required." });
    }
    if (!value.supplierId) {
      context.addIssue({ code: "custom", path: ["supplierId"], message: "A hotel supplier is required." });
    }
  } else if (value.hotelDetails) {
    context.addIssue({ code: "custom", path: ["hotelDetails"], message: "Hotel details are only valid for hotel services." });
  }
  if (value.serviceType === "FLIGHT" && !value.supplierId) {
    context.addIssue({ code: "custom", path: ["supplierId"], message: "An airline supplier is required." });
  }
  if (value.serviceType === "FLIGHT" && !value.flightDetails) {
    context.addIssue({ code: "custom", path: ["flightDetails"], message: "Flight segments and passengers are required." });
  }
  if (value.serviceType !== "FLIGHT" && value.flightDetails) {
    context.addIssue({ code: "custom", path: ["flightDetails"], message: "Flight details are only valid for flight services." });
  }
  if (value.serviceType === "VISA" && (!value.supplierId || !value.visaDetails)) {
    context.addIssue({ code: "custom", path: ["visaDetails"], message: "A visa provider and applicant details are required." });
  }
  if (value.serviceType !== "VISA" && value.visaDetails) {
    context.addIssue({ code: "custom", path: ["visaDetails"], message: "Visa details are only valid for visa services." });
  }
  const isPilgrimagePackage = value.serviceType === "UMRAH_PACKAGE" || value.serviceType === "HAJJ_PACKAGE";
  if (isPilgrimagePackage) {
    if (!value.supplierId || !value.packageDetails) {
      context.addIssue({ code: "custom", path: ["packageDetails"], message: "A tour operator and package traveller details are required." });
    }
    if (!value.startDate || value.startDate === "" || value.startDate !== value.packageDetails?.departureDate) {
      context.addIssue({ code: "custom", path: ["startDate"], message: "Package start date must match its departure date." });
    }
    if (!value.endDate || value.endDate === "" || value.endDate !== value.packageDetails?.returnDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "Package end date must match its return date." });
    }
  } else if (value.packageDetails) {
    context.addIssue({ code: "custom", path: ["packageDetails"], message: "Pilgrimage package details are only valid for Umrah or Hajj services." });
  }
});

export const bookingFileCreateSchema = z.object({
  customerId: z.string().trim().min(1).max(80),
  idempotencyKey: z.string().uuid(),
  branchId: z.string().trim().min(1).max(80).optional(),
  services: z.array(bookingFileServiceSchema).min(1).max(20)
});

export type BookingFileCreateInput = z.infer<typeof bookingFileCreateSchema>;
export type BookingFileServiceInput = z.infer<typeof bookingFileServiceSchema>;

export function asBookingDate(value: string | undefined): Date | null {
  return value && value.length > 0 ? new Date(value + "T12:00:00.000Z") : null;
}
