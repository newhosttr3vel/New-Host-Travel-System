import test from "node:test";
import assert from "node:assert/strict";
import { asBookingDate, bookingFileCreateSchema } from "../src/lib/booking-file-create";
import { bookingFileRequestHash } from "../src/lib/booking-file-idempotency";

const idempotencyKey = "11111111-1111-4111-8111-111111111111";
const genericService = { serviceType: "OTHER" as const };

test("booking-file input accepts multiple service lines and applies safe financial defaults", () => {
  const parsed = bookingFileCreateSchema.parse({
    customerId: "customer-1",
    idempotencyKey,
    services: [genericService, { serviceType: "UMRAH_PACKAGE", currency: "SAR", saleAmount: "2500.00" }]
  });

  assert.equal(parsed.services.length, 2);
  assert.equal(parsed.services[0]?.currency, "EGP");
  assert.equal(parsed.services[0]?.saleAmount, "0");
  assert.equal(parsed.services[0]?.costAmount, "0");
});

test("booking-file input requires at least one and allows no more than twenty services", () => {
  assert.equal(bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: []
  }).success, false);
  assert.equal(
    bookingFileCreateSchema.safeParse({
      customerId: "customer-1",
      idempotencyKey,
      services: Array.from({ length: 21 }, () => genericService)
    }).success,
    false
  );
});

test("booking-file service dates reject an end date earlier than the start date", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [{ serviceType: "OTHER", startDate: "2026-12-10", endDate: "2026-12-09" }]
  });
  assert.equal(parsed.success, false);
});

test("hotel services require a hotel supplier, stay dates and hotel details", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [{ serviceType: "HOTEL", supplierId: "hotel-supplier-1" }]
  });
  assert.equal(parsed.success, false);
});

test("flight services require an airline supplier and a complete flight manifest", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [{ serviceType: "FLIGHT" }]
  });
  assert.equal(parsed.success, false);
});

test("flight details validate segments, passengers and ticket status", () => {
  const validFlight = {
    serviceType: "FLIGHT",
    supplierId: "airline-supplier-1",
    flightDetails: {
      bookingReference: "ABC123",
      segments: [{
        carrierCode: "MS",
        flightNumber: "985",
        originCode: "CAI",
        destinationCode: "JED",
        departureAt: "2026-12-20T08:00:00+02:00",
        arrivalAt: "2026-12-20T12:00:00+03:00"
      }],
      passengers: [{ fullName: "TEST PASSENGER", passengerType: "ADULT" }]
    }
  };
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [validFlight]
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    const flight = parsed.data.services[0];
    assert.equal(flight?.serviceType, "FLIGHT");
    if (flight?.serviceType === "FLIGHT") {
      assert.equal(flight.flightDetails?.segments[0]?.cabinClass, "ECONOMY");
      assert.equal(flight.flightDetails?.passengers[0]?.ticketStatus, "PENDING");
    }
  }
});

test("flight details reject invalid times and issued tickets without numbers", () => {
  const baseFlight = {
    serviceType: "FLIGHT",
    supplierId: "airline-supplier-1",
    flightDetails: {
      segments: [{
        carrierCode: "MS",
        flightNumber: "985",
        originCode: "CAI",
        destinationCode: "JED",
        departureAt: "2026-12-20T08:00:00+02:00",
        arrivalAt: "2026-12-20T12:00:00+03:00"
      }],
      passengers: [{ fullName: "TEST PASSENGER", ticketStatus: "ISSUED" }]
    }
  };
  assert.equal(bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [baseFlight]
  }).success, false);

  const invalidTime = {
    ...baseFlight,
    flightDetails: {
      ...baseFlight.flightDetails,
      passengers: [{ fullName: "TEST PASSENGER" }],
      segments: [{
        ...baseFlight.flightDetails.segments[0],
        arrivalAt: "2026-12-20T07:00:00+02:00"
      }]
    }
  };
  assert.equal(bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [invalidTime]
  }).success, false);
});

test("visa services require a visa provider and applicant details", () => {
  const validVisa = {
    serviceType: "VISA",
    supplierId: "visa-provider-1",
    visaDetails: {
      destinationCountryCode: "SA",
      visaType: "UMRAH",
      status: "DRAFT",
      applicants: [{ fullName: "TEST APPLICANT", nationality: "EG", dateOfBirth: "1990-01-01" }]
    }
  };
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [validVisa]
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    const visa = parsed.data.services[0];
    assert.equal(visa?.serviceType, "VISA");
    if (visa?.serviceType === "VISA") {
      assert.equal(visa.visaDetails?.entryType, "SINGLE");
      assert.equal(visa.visaDetails?.status, undefined);
    }
  }
});

test("visa services reject invalid country codes, missing applicants and client-supplied workflow statuses", () => {
  const base = {
    serviceType: "VISA",
    supplierId: "visa-provider-1",
    visaDetails: {
      destinationCountryCode: "SA",
      visaType: "UMRAH",
      applicants: [{ fullName: "TEST APPLICANT" }]
    }
  };
  const invalidCountry = { ...base, visaDetails: { ...base.visaDetails, destinationCountryCode: "SAU" } };
  const noApplicants = { ...base, visaDetails: { ...base.visaDetails, applicants: [] } };
  const submittedAtCreation = { ...base, visaDetails: { ...base.visaDetails, status: "SUBMITTED" } };
  const issuedAtCreation = { ...base, visaDetails: { ...base.visaDetails, status: "ISSUED" } };
  for (const service of [invalidCountry, noApplicants, submittedAtCreation, issuedAtCreation]) {
    assert.equal(bookingFileCreateSchema.safeParse({
      customerId: "customer-1",
      idempotencyKey,
      services: [service]
    }).success, false);
  }
});

test("visa details cannot be attached to a non-visa service", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [{
      serviceType: "UMRAH_PACKAGE",
      visaDetails: {
        destinationCountryCode: "SA",
        visaType: "UMRAH",
        applicants: [{ fullName: "TEST APPLICANT" }]
      }
    }]
  });
  assert.equal(parsed.success, false);
});

test("flight details cannot be attached to non-flight services", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [{
      serviceType: "VISA",
      flightDetails: {
        segments: [{
          carrierCode: "MS",
          flightNumber: "985",
          originCode: "CAI",
          destinationCode: "JED",
          departureAt: "2026-12-20T08:00:00+02:00",
          arrivalAt: "2026-12-20T12:00:00+03:00"
        }],
        passengers: [{ fullName: "TEST PASSENGER" }]
      }
    }]
  });
  assert.equal(parsed.success, false);
});

test("hotel details cannot be attached to a non-hotel service", () => {
  const parsed = bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
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

test("booking-file creation requires a valid UUID idempotency key", () => {
  assert.equal(bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey,
    services: [genericService]
  }).success, true);
  assert.equal(bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    services: [genericService]
  }).success, false);
  assert.equal(bookingFileCreateSchema.safeParse({
    customerId: "customer-1",
    idempotencyKey: "not-a-uuid",
    services: [genericService]
  }).success, false);
});

test("booking-file request hashes ignore the idempotency key and normalize payload key order", () => {
  const first = bookingFileCreateSchema.parse({
    customerId: "customer-1",
    idempotencyKey,
    services: [genericService]
  });
  const second = bookingFileCreateSchema.parse({
    services: [genericService],
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    customerId: "customer-1"
  });
  assert.equal(bookingFileRequestHash(first), bookingFileRequestHash(second));
});
