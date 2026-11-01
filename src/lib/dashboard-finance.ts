export type DecimalLike = string | number | { toString(): string } | null | undefined;

function decimalText(value: DecimalLike, label: string): string {
  if (value === null || value === undefined) return "0";
  const text = typeof value === "string" || typeof value === "number" ? String(value) : value.toString();
  if (!text || text.length > 32) throw new Error(`Invalid ${label} value.`);
  return text;
}

function amountToCents(value: DecimalLike): bigint {
  const text = decimalText(value, "amount");
  if (!/^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,2})?$/.test(text)) {
    throw new Error("Invalid monetary amount in dashboard aggregation.");
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
}

function rateToUnits(value: DecimalLike): bigint {
  const text = decimalText(value, "exchange rate");
  if (!/^(?:0|[1-9]\\d{0,8})(?:\\.\\d{1,8})?$/.test(text)) {
    throw new Error("Invalid exchange rate in dashboard aggregation.");
  }
  const [whole, fraction = ""] = text.split(".");
  const units = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0");
  if (units <= 0n) throw new Error("Exchange rate must be greater than zero.");
  return units;
}

/** Converts transaction-currency cents to base-currency cents using the stored rate snapshot. */
export function amountToBaseCents(amount: DecimalLike, exchangeRate: DecimalLike): bigint {
  const amountCents = amountToCents(amount);
  const rateUnits = rateToUnits(exchangeRate);
  const rateScale = 100_000_000n;
  return (amountCents * rateUnits + rateScale / 2n) / rateScale;
}

export type BaseAmountGroup = {
  amount: DecimalLike;
  exchangeRate: DecimalLike;
};

export function sumBaseCents(groups: readonly BaseAmountGroup[]): bigint {
  return groups.reduce(
    (sum, group) => sum + amountToBaseCents(group.amount, group.exchangeRate),
    0n,
  );
}

export type OutstandingAmountGroup = {
  total: DecimalLike;
  paidAmount: DecimalLike;
  exchangeRate: DecimalLike;
};

export function sumOutstandingBaseCents(groups: readonly OutstandingAmountGroup[]): bigint {
  return groups.reduce((sum, group) => {
    const outstandingCents = amountToCents(group.total) - amountToCents(group.paidAmount);
    const outstanding = outstandingCents < 0n ? 0n : outstandingCents;
    return sum + amountToBaseCents(
      (outstanding / 100n).toString() + "." + (outstanding % 100n).toString().padStart(2, "0"),
      group.exchangeRate,
    );
  }, 0n);
}
