import test from "node:test";
import assert from "node:assert/strict";
import { asBookingDate, bookingFileCreateSchema } from "../src/lib/booking-file-create";

const visaService = { serviceType: "VISA" as const };

test("booking-file input accepts multiple service lines and applies safe financial defaults", () => {
  const parsed = bookingFileCreateSchema.parse({
    customerId: "customer-1",
    services: [visaService, { serviceType: "UMRAH_PACKAGE", currency: "SAR", saleAmount: "2500.00" }]
  });

  assert.equal(parsed.services.length, 2);
  assert.equal(parsed.services[0]?.currency, "EGP");
  assert.equal(parsed.services[0]?.saleAmount, "0");
  assert.equal(parsed.services[0]?.costAmount, "0");
});

test("booking-file input requires at least one and allows no more than twenty services", () => {
  assert.equal(bookingFileCreateSchema.safeParse({ customerId: "customer-1", services: [] }).success, false);
  assert.equal(
    bookingFileCreateSchema.safeParse({
      customerId: "customer-1",
      services: Array.from({ length: 21 }, () => visaService)
    }).success,
    false
  );
});

test("booking-file service dates reject an end date earlier than the start date", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    services: [{ serviceType: "VISA", startDate: "2026-12-10", endDate: "2026-12-09" }]
  });
  assert.equal(parsed.success, false);
});

test("hotel services require a hotel supplier, stay dates and hotel details", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    services: [{ serviceType: "HOTEL", supplierId: "hotel-supplier-1" }]
  });
  assert.equal(parsed.success, false);
});

test("flight services require an airline supplier", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    services: [{ serviceType: "FLIGHT" }]
  });
  assert.equal(parsed.success, false);
});

test("hotel details cannot be attached to a non-hotel service", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    services: [{
      serviceType: "VISA",
      hotelDetails: {
        hotelId: "hotel-1",
        guestName: "Test Guest",
        rooms: [{
          roomCount: 1,
          roomType: "Standard",
          mealPlan: "RO",
          adults: 1,
          children: 0,
          rates: [{ stayDate: "2026-12-10" }]
        }]
      }
    }]
  });
  assert.equal(parsed.success, false);
});

test("empty optional date values normalize to null instead of an invalid Date", () => {
  assert.equal(asBookingDate(""), null);
  assert.equal(asBookingDate(undefined), null);
  assert.equal(asBookingDate("2026-12-10")?.toISOString(), "2026-12-10T12:00:00.000Z");
});
