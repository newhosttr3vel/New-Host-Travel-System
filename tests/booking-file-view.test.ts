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
    costAmount: decimal("1000.00")
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
