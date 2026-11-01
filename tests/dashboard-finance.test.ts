import test from "node:test";
import assert from "node:assert/strict";
import {
  amountToBaseCents,
  sumBaseCents,
  sumOutstandingBaseCents,
} from "../src/lib/dashboard-finance";

test("converts a foreign-currency amount using its persisted exchange-rate snapshot", () => {
  assert.equal(amountToBaseCents("100.00", "12.90000000"), 129000n);
});

test("sums different transaction currencies only after converting each group to base currency", () => {
  assert.equal(sumBaseCents([
    { amount: "100.00", exchangeRate: "12.9" },
    { amount: "10.00", exchangeRate: "1" },
    { amount: "20.00", exchangeRate: "0.5" },
  ]), 131000n);
});

test("calculates outstanding balances from total less payments before conversion", () => {
  assert.equal(sumOutstandingBaseCents([
    { total: "120.00", paidAmount: "20.00", exchangeRate: "2" },
    { total: "50.00", paidAmount: "50.00", exchangeRate: "12.9" },
  ]), 20000n);
});

test("rounds half a base-currency cent up deterministically", () => {
  assert.equal(amountToBaseCents("0.01", "0.5"), 1n);
});

test("rejects invalid amounts and non-positive exchange rates", () => {
  assert.throws(() => amountToBaseCents("1.001", "1"));
  assert.throws(() => amountToBaseCents("1.00", "0"));
});

test("does not report a negative receivable if historical paid amount exceeds the invoice total", () => {
  assert.equal(sumOutstandingBaseCents([
    { total: "10.00", paidAmount: "12.00", exchangeRate: "1" },
  ]), 0n);
});
