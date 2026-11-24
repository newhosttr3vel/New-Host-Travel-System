import test from "node:test";
import assert from "node:assert/strict";
import { serializeBookingFile } from "../src/lib/booking-file-view";

function decimal(value: string) {
  return { toString: () => value };
}

const record = {
  id: "booking-file-1",
  reference: "NHT-BF-001",
  reservations: [{
    id: "reservation-1",
    reference: "NHT-SVC-001",
    saleAmount: decimal("1250.00"),
    costAmount: decimal("1000.00"),
    flightDetail: {
      bookingReference: "ABC123",
      passengers: [{
        nationality: "EG",
        ticketNumber: "0987654321098"
      }]
    },
    visaDetail: {
      applicationReference: "VISA-APP-123",
      applicants: [{
        nationality: "EG",
        dateOfBirth: new Date("1990-01-01T12:00:00.000Z")
      }]
    },
    pilgrimagePackageDetail: {
      id: "package-detail-1",
      packageType: "UMRAH",
      packageName: "December Umrah",
      departureCity: "Cairo",
      departureDate: new Date("2026-12-10T12:00:00.000Z"),
      returnDate: new Date("2026-12-20T12:00:00.000Z"),
      groupReference: "GROUP-2026-12",
      accommodationLevel: "FOUR_STAR",
      mealPlan: "BREAKFAST",
      transportIncluded: true,
      includedServices: ["Makkah accommodation"],
      travellers: [{ id: "pilgrim-1", fullName: "TEST PILGRIM", travellerType: "ADULT", nationality: "EG" }]
    }
  }]
};

test("booking file projection hides service costs from users without finance:read", () => {
  const result = serializeBookingFile(record, false);
  assert.equal(result.reservations[0]?.saleAmount, "1250.00");
  assert.equal(result.reservations[0]?.costAmount, null);
});

test("booking file projection exposes service costs to users with finance:read", () => {
  const result = serializeBookingFile(record, true);
  assert.equal(result.reservations[0]?.saleAmount, "1250.00");
  assert.equal(result.reservations[0]?.costAmount, "1000.00");
});

test("booking file projection masks flight booking and ticket references without documents:read", () => {
  const result = serializeBookingFile(record, false, false);
  assert.equal(result.reservations[0]?.flightDetail?.bookingReference, null);
  assert.equal(result.reservations[0]?.flightDetail?.passengers[0]?.nationality, null);
  assert.equal(result.reservations[0]?.flightDetail?.passengers[0]?.ticketNumber, null);
});

test("booking file projection exposes flight references only with documents:read", () => {
  const result = serializeBookingFile(record, false, true);
  assert.equal(result.reservations[0]?.flightDetail?.bookingReference, "ABC123");
  assert.equal(result.reservations[0]?.flightDetail?.passengers[0]?.nationality, "EG");
  assert.equal(result.reservations[0]?.flightDetail?.passengers[0]?.ticketNumber, "0987654321098");
});

test("booking file projection masks visa application references and applicant details without documents:read", () => {
  const result = serializeBookingFile(record, false, false);
  assert.equal(result.reservations[0]?.visaDetail?.applicationReference, null);
  assert.equal(result.reservations[0]?.visaDetail?.applicants[0]?.nationality, null);
  assert.equal(result.reservations[0]?.visaDetail?.applicants[0]?.dateOfBirth, null);
});

test("booking file projection exposes visa applicant details only with documents:read", () => {
  const result = serializeBookingFile(record, false, true);
  assert.equal(result.reservations[0]?.visaDetail?.applicationReference, "VISA-APP-123");
  assert.equal(result.reservations[0]?.visaDetail?.applicants[0]?.nationality, "EG");
  assert.equal(
    result.reservations[0]?.visaDetail?.applicants[0]?.dateOfBirth?.toISOString(),
    "1990-01-01T12:00:00.000Z"
  );
});


test("booking file projection masks pilgrimage traveller nationality without documents:read", () => {
  const result = serializeBookingFile(record, false, false);
  assert.equal(result.reservations[0]?.pilgrimagePackageDetail?.packageName, "December Umrah");
  assert.equal(result.reservations[0]?.pilgrimagePackageDetail?.travellers[0]?.fullName, "TEST PILGRIM");
  assert.equal(result.reservations[0]?.pilgrimagePackageDetail?.travellers[0]?.nationality, null);
});

test("booking file projection exposes pilgrimage traveller nationality only with documents:read", () => {
  const result = serializeBookingFile(record, false, true);
  assert.equal(result.reservations[0]?.pilgrimagePackageDetail?.travellers[0]?.nationality, "EG");
});
