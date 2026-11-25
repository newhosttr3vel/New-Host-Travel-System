import { amountToCents, centsToAmount } from "@/lib/finance-journal";

type DecimalLike = { toString(): string };

type FinancialPayment = {
  id: string;
  paymentDate: Date;
  method: string;
  amount: DecimalLike;
  currency: string;
  reference: string | null;
  receiptNumber?: string;
  paymentNumber?: string;
  journalEntry: { reference: string };
};

type FinancialDocument = {
  id: string;
  reference: string;
  status: string;
  currency: string;
  total: DecimalLike;
  paidAmount: DecimalLike;
  dueDate: Date | null;
  issueDate?: Date;
  billDate?: Date;
  supplier?: { id: string; name: string };
  payments: FinancialPayment[];
};

type ReservationFinancialRecord = {
  id: string;
  reference: string;
  serviceType: string;
  status: string;
  currency: string;
  saleAmount: DecimalLike;
  costAmount: DecimalLike;
  archivedAt: Date | null;
  invoices: FinancialDocument[];
  supplierBills: FinancialDocument[];
};

type BookingFileFinancialRecord = {
  id: string;
  reference: string;
  createdAt: Date;
  customer: { id: string; name: string; companyName: string | null };
  reservations: ReservationFinancialRecord[];
};

type CurrencyAccumulator = {
  currency: string;
  estimatedSales: bigint;
  estimatedCosts: bigint;
  invoiced: bigint;
  collected: bigint;
  supplierBilled: bigint;
  supplierPaid: bigint;
};

function getCurrency(
  currencies: Map<string, CurrencyAccumulator>,
  currency: string
): CurrencyAccumulator {
  let value = currencies.get(currency);
  if (!value) {
    value = {
      currency,
      estimatedSales: 0n,
      estimatedCosts: 0n,
      invoiced: 0n,
      collected: 0n,
      supplierBilled: 0n,
      supplierPaid: 0n
    };
    currencies.set(currency, value);
  }
  return value;
}

function serializeDocument(document: FinancialDocument, date: Date, kind: "INVOICE" | "SUPPLIER_BILL") {
  const includedInTotals = document.status !== "VOID";
  const total = amountToCents(document.total.toString());
  const paid = amountToCents(document.paidAmount.toString());
  return {
    id: document.id,
    reference: document.reference,
    status: document.status,
    currency: document.currency,
    documentDate: date.toISOString(),
    dueDate: document.dueDate?.toISOString() ?? null,
    total: document.total.toString(),
    paidAmount: document.paidAmount.toString(),
    outstandingAmount: includedInTotals ? centsToAmount(total - paid) : null,
    includedInTotals,
    payments: document.payments.map((payment) => ({
      id: payment.id,
      number: payment.receiptNumber ?? payment.paymentNumber ?? null,
      paymentDate: payment.paymentDate.toISOString(),
      method: payment.method,
      amount: payment.amount.toString(),
      currency: payment.currency,
      reference: payment.reference,
      journalReference: payment.journalEntry.reference
    })),
    ...(kind === "SUPPLIER_BILL" ? { supplier: document.supplier ?? null } : {})
  };
}

/**
 * Produces a read-only financial snapshot for one booking file.
 * Every amount remains in its source currency; no cross-currency totals are calculated.
 * Reservation amounts are estimates, while invoices and supplier bills are posted documents.
 */
export function summarizeBookingFileFinancials(item: BookingFileFinancialRecord) {
  const currencies = new Map<string, CurrencyAccumulator>();

  const reservations = item.reservations.map((reservation) => {
    const estimate = getCurrency(currencies, reservation.currency);
    const sale = amountToCents(reservation.saleAmount.toString());
    const cost = amountToCents(reservation.costAmount.toString());
    estimate.estimatedSales += sale;
    estimate.estimatedCosts += cost;

    const invoices = reservation.invoices.map((invoice) => {
      const serialized = serializeDocument(invoice, invoice.issueDate!, "INVOICE");
      if (serialized.includedInTotals) {
        const totals = getCurrency(currencies, invoice.currency);
        totals.invoiced += amountToCents(invoice.total.toString());
        totals.collected += amountToCents(invoice.paidAmount.toString());
      }
      return serialized;
    });

    const supplierBills = reservation.supplierBills.map((bill) => {
      const serialized = serializeDocument(bill, bill.billDate!, "SUPPLIER_BILL");
      if (serialized.includedInTotals) {
        const totals = getCurrency(currencies, bill.currency);
        totals.supplierBilled += amountToCents(bill.total.toString());
        totals.supplierPaid += amountToCents(bill.paidAmount.toString());
      }
      return serialized;
    });

    return {
      id: reservation.id,
      reference: reservation.reference,
      serviceType: reservation.serviceType,
      status: reservation.status,
      archivedAt: reservation.archivedAt?.toISOString() ?? null,
      estimate: {
        currency: reservation.currency,
        saleAmount: centsToAmount(sale),
        costAmount: centsToAmount(cost),
        grossMarginEstimate: centsToAmount(sale - cost)
      },
      invoices,
      supplierBills
    };
  });

  return {
    bookingFile: {
      id: item.id,
      reference: item.reference,
      createdAt: item.createdAt.toISOString(),
      customer: item.customer
    },
    currencySummaries: [...currencies.values()]
      .sort((left, right) => left.currency.localeCompare(right.currency))
      .map((value) => ({
        currency: value.currency,
        estimates: {
          sales: centsToAmount(value.estimatedSales),
          costs: centsToAmount(value.estimatedCosts),
          grossMargin: centsToAmount(value.estimatedSales - value.estimatedCosts)
        },
        receivables: {
          invoiced: centsToAmount(value.invoiced),
          collected: centsToAmount(value.collected),
          outstanding: centsToAmount(value.invoiced - value.collected)
        },
        payables: {
          billed: centsToAmount(value.supplierBilled),
          paid: centsToAmount(value.supplierPaid),
          outstanding: centsToAmount(value.supplierBilled - value.supplierPaid)
        }
      })),
    reservations
  };
}
