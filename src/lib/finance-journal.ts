export type JournalLineInput = {
  accountId: string;
  memo?: string;
  debit: string;
  credit: string;
};

export type NormalizedJournalLine = {
  accountId: string;
  memo: string | null;
  debit: string;
  credit: string;
  baseDebit: string;
  baseCredit: string;
};

export class JournalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalValidationError";
  }
}

const RATE_SCALE = 100_000_000n;

export function amountToCents(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value)) {
    throw new JournalValidationError("Invalid monetary amount.");
  }
  const parts = value.split(".");
  return BigInt(parts[0]) * 100n + BigInt((parts[1] ?? "").padEnd(2, "0") || "0");
}

export function centsToAmount(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return (cents < 0n ? "-" : "") + (absolute / 100n).toString() + "." + (absolute % 100n).toString().padStart(2, "0");
}

export function rateToUnits(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/.test(value)) {
    throw new JournalValidationError("Exchange rate must be positive with up to 8 decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * RATE_SCALE + BigInt(fraction.padEnd(8, "0") || "0");
  if (units <= 0n) throw new JournalValidationError("Exchange rate must be greater than zero.");
  return units;
}

function convertToBaseCents(amount: bigint, rateUnits: bigint): bigint {
  return (amount * rateUnits + RATE_SCALE / 2n) / RATE_SCALE;
}

export function normalizeJournalLines(
  lines: JournalLineInput[],
  exchangeRate: string,
): { lines: NormalizedJournalLine[]; total: string; baseTotal: string; exchangeRate: string } {
  if (lines.length < 2 || lines.length > 100) {
    throw new JournalValidationError("A journal must contain between 2 and 100 lines.");
  }
  const rateUnits = rateToUnits(exchangeRate);
  const prepared = lines.map((line) => {
    if (!line.accountId.trim()) throw new JournalValidationError("Every journal line must have an account.");
    const debit = amountToCents(line.debit);
    const credit = amountToCents(line.credit);
    if ((debit > 0n && credit > 0n) || (debit === 0n && credit === 0n)) {
      throw new JournalValidationError("Each line must have either a debit or a credit, but not both.");
    }
    const baseDebit = debit > 0n ? convertToBaseCents(debit, rateUnits) : 0n;
    const baseCredit = credit > 0n ? convertToBaseCents(credit, rateUnits) : 0n;
    if ((debit > 0n && baseDebit === 0n) || (credit > 0n && baseCredit === 0n)) {
      throw new JournalValidationError("The exchange rate converts a line to zero in the base currency.");
    }
    return { accountId: line.accountId, memo: line.memo?.trim() || null, debit, credit, baseDebit, baseCredit };
  });

  const totalDebit = prepared.reduce((sum, line) => sum + line.debit, 0n);
  const totalCredit = prepared.reduce((sum, line) => sum + line.credit, 0n);
  if (totalDebit === 0n || totalDebit !== totalCredit) {
    throw new JournalValidationError("Total debits must equal total credits in the transaction currency.");
  }

  const baseTotalCents = convertToBaseCents(totalDebit, rateUnits);

  function reconcileBaseSide(side: "debit" | "credit") {
    const baseKey = side === "debit" ? "baseDebit" : "baseCredit";
    const amountKey = side === "debit" ? "debit" : "credit";
    const currentTotal = prepared.reduce((sum, line) => sum + line[baseKey], 0n);
    const difference = baseTotalCents - currentTotal;
    if (difference === 0n) return;

    const absoluteDifference = difference < 0n ? -difference : difference;
    const sideLineCount = prepared.filter((line) => line[amountKey] > 0n).length;
    if (absoluteDifference > BigInt(Math.max(1, sideLineCount))) {
      throw new JournalValidationError("Converted debit and credit totals do not balance.");
    }

    let targetIndex = -1;
    let largestAmount = -1n;
    prepared.forEach((line, index) => {
      if (line[amountKey] > largestAmount && line[amountKey] > 0n) {
        largestAmount = line[amountKey];
        targetIndex = index;
      }
    });
    if (targetIndex < 0) throw new JournalValidationError("Unable to reconcile currency rounding.");

    const adjusted = prepared[targetIndex][baseKey] + difference;
    if (adjusted <= 0n) {
      throw new JournalValidationError("Currency rounding would make a posted base-currency line zero.");
    }
    prepared[targetIndex][baseKey] = adjusted;
  }

  reconcileBaseSide("debit");
  reconcileBaseSide("credit");

  return {
    lines: prepared.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: centsToAmount(line.debit),
      credit: centsToAmount(line.credit),
      baseDebit: centsToAmount(line.baseDebit),
      baseCredit: centsToAmount(line.baseCredit),
    })),
    total: centsToAmount(totalDebit),
    baseTotal: centsToAmount(baseTotalCents),
    exchangeRate: (rateUnits / RATE_SCALE).toString() + "." + (rateUnits % RATE_SCALE).toString().padStart(8, "0"),
  };
}
