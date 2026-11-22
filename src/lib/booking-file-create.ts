import { z } from "zod";
import { hotelReservationDetailsSchema } from "@/lib/hotel-pricing";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const optionalDate = z.union([dateOnly, z.literal("")]).optional();
const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);

export const bookingFileServiceSchema = z.object({
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
