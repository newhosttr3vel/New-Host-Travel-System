import { amountToCents, centsToAmount, JournalValidationError } from "@/lib/finance-journal";

export type InvoiceLineInput = { description: string; quantity: string; unitPrice: string; revenueAccountId: string };
export type CalculatedInvoiceLine = InvoiceLineInput & { amount: string };

const MAX_AMOUNT_CENTS = 99_999_999_999_999n;

export function calculateInvoiceLines(lines: InvoiceLineInput[]): { lines: CalculatedInvoiceLine[]; subtotal: string } {
  if (lines.length < 1 || lines.length > 100) throw new JournalValidationError("An invoice must contain between 1 and 100 lines.");
  let subtotal = 0n;
  const calculated = lines.map((line) => {
    const description = line.description.trim();
    if (description.length < 2 || description.length > 240) throw new JournalValidationError("Each invoice line needs a description.");
    if (!line.revenueAccountId.trim()) throw new JournalValidationError("Every invoice line must have a revenue account.");
    const quantity = amountToCents(line.quantity);
    const unitPrice = amountToCents(line.unitPrice);
    if (quantity <= 0n || unitPrice <= 0n) throw new JournalValidationError("Quantity and unit price must be greater than zero.");
    const lineAmount = (quantity * unitPrice + 50n) / 100n;
    if (lineAmount <= 0n || lineAmount > MAX_AMOUNT_CENTS) throw new JournalValidationError("Invoice line amount is outside the supported range.");
    subtotal += lineAmount;
    if (subtotal > MAX_AMOUNT_CENTS) throw new JournalValidationError("Invoice subtotal is outside the supported range.");
    return { ...line, description, quantity: centsToAmount(quantity), unitPrice: centsToAmount(unitPrice), amount: centsToAmount(lineAmount) };
  });
  return { lines: calculated, subtotal: centsToAmount(subtotal) };
}

export function calculateInvoiceTotal(subtotal: string, taxAmount: string): { subtotal: string; taxAmount: string; total: string } {
  const subtotalCents = amountToCents(subtotal);
  const taxCents = amountToCents(taxAmount);
  if (subtotalCents <= 0n) throw new JournalValidationError("Invoice subtotal must be greater than zero.");
  if (taxCents < 0n) throw new JournalValidationError("Tax amount cannot be negative.");
  const total = subtotalCents + taxCents;
  if (total > MAX_AMOUNT_CENTS) throw new JournalValidationError("Invoice total is outside the supported range.");
  return { subtotal: centsToAmount(subtotalCents), taxAmount: centsToAmount(taxCents), total: centsToAmount(total) };
}
