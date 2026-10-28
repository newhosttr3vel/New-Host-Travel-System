import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionReservationStatus } from "../src/lib/reservation-workflow";

test("reservation can progress from inquiry into a quote and confirmation", () => {
  assert.equal(canTransitionReservationStatus("INQUIRY", "QUOTATION"), true);
  assert.equal(canTransitionReservationStatus("QUOTATION", "PENDING"), true);
  assert.equal(canTransitionReservationStatus("PENDING", "CONFIRMED"), true);
});
test("reservation cannot skip from inquiry directly to paid", () => {
  assert.equal(canTransitionReservationStatus("INQUIRY", "FULLY_PAID"), false);
});
test("refunded is a terminal state", () => {
  assert.equal(canTransitionReservationStatus("REFUNDED", "CONFIRMED"), false);
  assert.equal(canTransitionReservationStatus("REFUNDED", "REFUNDED"), true);
});
test("unknown status fails closed", () => {
  assert.equal(canTransitionReservationStatus("PLANNED", "CONFIRMED"), false);
});
