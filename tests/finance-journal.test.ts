import test from "node:test";
import assert from "node:assert/strict";
import {
  JournalValidationError,
  normalizeJournalLines,
  amountToCents,
  centsToAmount,
} from "../src/lib/finance-journal";

test("accepts a balanced two-line journal and normalizes money to cents", () => {
  const result = normalizeJournalLines([
    { accountId: "cash", debit: "125", credit: "0" },
    { accountId: "revenue", debit: "0", credit: "125.00" },
  ], "1");
  assert.equal(result.total, "125.00");
  assert.equal(result.baseTotal, "125.00");
  assert.equal(result.lines[0].baseDebit, "125.00");
});

test("rejects an unbalanced journal", () => {
  assert.throws(() => normalizeJournalLines([
    { accountId: "cash", debit: "100.00", credit: "0" },
    { accountId: "revenue", debit: "0", credit: "99.99" },
  ], "1"), JournalValidationError);
});

test("rejects a line with both debit and credit", () => {
  assert.throws(() => normalizeJournalLines([
    { accountId: "cash", debit: "1", credit: "1" },
    { accountId: "revenue", debit: "0", credit: "2" },
  ], "1"), /either a debit or a credit/);
});

test("converts foreign-currency amounts using integer arithmetic", () => {
  const result = normalizeJournalLines([
    { accountId: "cash", debit: "100.00", credit: "0" },
    { accountId: "revenue", debit: "0", credit: "100.00" },
  ], "12.90000000");
  assert.equal(result.total, "100.00");
  assert.equal(result.baseTotal, "1290.00");
  assert.equal(result.exchangeRate, "12.90000000");
});

test("reconciles small per-line base-currency rounding differences", () => {
  const result = normalizeJournalLines([
    { accountId: "cash", debit: "10.00", credit: "0" },
    { accountId: "expense-a", debit: "0", credit: "3.33" },
    { accountId: "expense-b", debit: "0", credit: "3.33" },
    { accountId: "expense-c", debit: "0", credit: "3.34" },
  ], "12.9");
  const debits = result.lines.reduce((sum, line) => sum + amountToCents(line.baseDebit), 0n);
  const credits = result.lines.reduce((sum, line) => sum + amountToCents(line.baseCredit), 0n);
  assert.equal(debits, credits);
  assert.equal(centsToAmount(debits), "129.00");
});

test("rejects a conversion that rounds a posted line to zero", () => {
  assert.throws(() => normalizeJournalLines([
    { accountId: "cash", debit: "0.01", credit: "0" },
    { accountId: "revenue", debit: "0", credit: "0.01" },
  ], "0.00000001"), /converts a line to zero/);
});
