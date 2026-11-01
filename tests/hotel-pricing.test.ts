import test from "node:test";
import assert from "node:assert/strict";
import { hotelReservationDetailsSchema, normalizeHotelReservation, hotelNightCount, restorePersistedHotelCosts } from "../src/lib/hotel-pricing";

function details() {
  return hotelReservationDetailsSchema.parse({
    hotelId: "hotel-123",
    guestName: "Ahmed Ali",
    guestNationality: "Egyptian",
    rooms: [{
      roomCount: 2,
      roomType: "Standard Double",
      mealPlan: "BB",
      adults: 2,
      children: 1,
      rates: [
        { stayDate: "2026-12-01", saleRoomRate: "100.00", saleMealRatePerPax: "10.00", saleVat: "20.00", costRoomRate: "70.00", costMealRatePerPax: "5.00", costVat: "14.00" },
        { stayDate: "2026-12-02", saleRoomRate: "120.00", saleMealRatePerPax: "10.00", saleVat: "24.00", costRoomRate: "80.00", costMealRatePerPax: "5.00", costVat: "16.00" }
      ]
    }]
  });
}

test("counts hotel nights with departure date excluded", () => {
  assert.equal(hotelNightCount("2026-12-01", "2026-12-03"), 2);
});

test("calculates multi-room, per-night sale, meal and VAT totals using integer cents", () => {
  const result = normalizeHotelReservation(details(), "2026-12-01", "2026-12-03", true);
  assert.equal(result.nights, 2);
  assert.equal(result.totalRooms, 2);
  assert.equal(result.totalRoomNights, 4);
  assert.equal(result.totalPax, 3);
  assert.equal(result.saleAmount, "544.00");
  assert.equal(result.costAmount, "360.00");
});

test("never persists supplier costs submitted by a user without finance access", () => {
  const result = normalizeHotelReservation(details(), "2026-12-01", "2026-12-03", false);
  assert.equal(result.saleAmount, "544.00");
  assert.equal(result.costAmount, "0.00");
  assert.equal(result.rooms[0].rates[0].costRoomRate, "0.00");
});

test("rejects missing night rates and mismatched date rows", () => {
  const input = details();
  assert.throws(() => normalizeHotelReservation({ ...input, rooms: [{ ...input.rooms[0], rates: input.rooms[0].rates.slice(0, 1) }] }, "2026-12-01", "2026-12-03", true), /HOTEL_NIGHT_RATES_REQUIRED/);
  assert.throws(() => normalizeHotelReservation({ ...input, rooms: [{ ...input.rooms[0], rates: [{ ...input.rooms[0].rates[0], stayDate: "2026-12-03" }, input.rooms[0].rates[1]] }] }, "2026-12-01", "2026-12-03", true), /HOTEL_NIGHT_RATE_DATE_MISMATCH/);
});

test("rejects departure on or before arrival", () => {
  assert.throws(() => hotelNightCount("2026-12-01", "2026-12-01"), /INVALID_HOTEL_DATE_RANGE/);
});


test("restores hidden supplier costs by matching persisted room IDs and stay dates", () => {
  const input = details();
  const withUntrustedCosts = {
    ...input,
    rooms: [{
      ...input.rooms[0],
      id: "saved-room-1",
      rates: input.rooms[0].rates.map((rate) => ({
        ...rate,
        costRoomRate: "9999.00",
        costMealRatePerPax: "9999.00",
        costVat: "9999.00",
      })),
    }],
  };
  const restored = restorePersistedHotelCosts(withUntrustedCosts, [{
    id: "saved-room-1",
    nightlyRates: [
      { stayDate: new Date("2026-12-01T12:00:00.000Z"), costRoomRate: { toString: () => "70.00" }, costMealRatePerPax: { toString: () => "5.00" }, costVat: { toString: () => "14.00" } },
      { stayDate: new Date("2026-12-02T12:00:00.000Z"), costRoomRate: { toString: () => "80.00" }, costMealRatePerPax: { toString: () => "5.00" }, costVat: { toString: () => "16.00" } },
    ],
  }]);
  assert.equal(restored.rooms[0].rates[0].costRoomRate, "70.00");
  assert.equal(restored.rooms[0].rates[1].costVat, "16.00");
});

test("new room IDs and newly added nights never inherit another room's saved costs", () => {
  const input = details();
  const restored = restorePersistedHotelCosts({
    ...input,
    rooms: [{
      ...input.rooms[0],
      id: "new-room-id",
      rates: [{ ...input.rooms[0].rates[0], stayDate: "2026-12-03", costRoomRate: "12345.00" }],
    }],
  }, [{
    id: "saved-room-1",
    nightlyRates: [
      { stayDate: new Date("2026-12-01T12:00:00.000Z"), costRoomRate: { toString: () => "70.00" }, costMealRatePerPax: { toString: () => "5.00" }, costVat: { toString: () => "14.00" } },
    ],
  }]);
  assert.equal(restored.rooms[0].rates[0].costRoomRate, "0.00");
  assert.equal(restored.rooms[0].rates[0].costVat, "0.00");
});


test("requires a hotel from the hotel directory", () => {
  const input = { ...details(), hotelId: "" };
  assert.equal(hotelReservationDetailsSchema.safeParse(input).success, false);
});
