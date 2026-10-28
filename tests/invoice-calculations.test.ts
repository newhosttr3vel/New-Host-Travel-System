import test from "node:test";
import assert from "node:assert/strict";
import { calculateInvoiceLines, calculateInvoiceTotal } from "../src/lib/invoice-calculations";

test("rounds fractional quantities deterministically to cents", () => {
  const result = calculateInvoiceLines([
    { description: "Hotel nights", quantity: "2.50", unitPrice: "123.45", revenueAccountId: "revenue" }
  ]);
  assert.equal(result.lines[0].amount, "308.63");
  assert.equal(result.subtotal, "308.63");
});

test("calculates subtotal and tax with decimal-safe arithmetic", () => {
  assert.deepEqual(calculateInvoiceTotal("308.63", "15.43"), {
    subtotal: "308.63", taxAmount: "15.43", total: "324.06"
  });
});

test("rejects non-positive quantity and price", () => {
  assert.throws(() => calculateInvoiceLines([
    { description: "Invalid", quantity: "0", unitPrice: "10", revenueAccountId: "revenue" }
  ]));
});

test("rejects an invoice whose total exceeds Decimal(14,2)", () => {
  assert.throws(() => calculateInvoiceTotal("999999999999.99", "0.01"));
});
