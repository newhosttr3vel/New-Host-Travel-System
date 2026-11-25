import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBookingFileFinancials } from "../src/lib/booking-file-financial-summary";

function decimal(value: string) {
  return { toString: () => value };
}

const record = {
  id: "booking-file-1",
  reference: "NHT-BF-001",
  createdAt: new Date("2026-11-25T08:00:00.000Z"),
  customer: { id: "customer-1", name: "B2B Agency", companyName: "B2B Agency LLC" },
  reservations: [
    {
      id: "reservation-egp",
      reference: "NHT-SVC-EGP",
      serviceType: "HOTEL",
      status: "CONFIRMED",
      currency: "EGP",
      saleAmount: decimal("1250.10"),
      costAmount: decimal("1000.05"),
      archivedAt: null,
      invoices: [{
        id: "invoice-1",
        reference: "INV-001",
        status: "PARTIALLY_PAID",
        currency: "EGP",
        issueDate: new Date("2026-11-20T12:00:00.000Z"),
        dueDate: new Date("2026-11-30T12:00:00.000Z"),
        total: decimal("1250.10"),
        paidAmount: decimal("500.05"),
        payments: [{
          id: "receipt-1",
          receiptNumber: "RCPT-001",
          paymentDate: new Date("2026-11-23T12:00:00.000Z"),
          method: "BANK_TRANSFER",
          amount: decimal("500.05"),
          currency: "EGP",
          reference: "BANK-REF-001",
          journalEntry: { reference: "JRN-001" }
        }]
      }, {
        id: "invoice-void",
        reference: "INV-VOID",
        status: "VOID",
        currency: "EGP",
        issueDate: new Date("2026-11-21T12:00:00.000Z"),
        dueDate: null,
        total: decimal("999.99"),
        paidAmount: decimal("0.00"),
        payments: []
      }],
      supplierBills: [{
        id: "bill-1",
        reference: "BILL-001",
        status: "PARTIALLY_PAID",
        currency: "EGP",
        billDate: new Date("2026-11-21T12:00:00.000Z"),
        dueDate: new Date("2026-12-01T12:00:00.000Z"),
        total: decimal("800.00"),
        paidAmount: decimal("300.00"),
        payments: [{
          id: "supplier-payment-1",
          paymentNumber: "PAY-001",
          paymentDate: new Date("2026-11-24T12:00:00.000Z"),
          method: "BANK_TRANSFER",
          amount: decimal("300.00"),
          currency: "EGP",
          reference: "SUP-BANK-001",
          journalEntry: { reference: "JRN-002" }
        }],
        supplier: { id: "supplier-1", name: "Hotel Supplier" }
      }]
    },
    {
      id: "reservation-sar",
      reference: "NHT-SVC-SAR",
      serviceType: "UMRAH_PACKAGE",
      status: "PENDING",
      currency: "SAR",
      saleAmount: decimal("4200.00"),
      costAmount: decimal("3650.00"),
      archivedAt: new Date("2026-11-24T12:00:00.000Z"),
      invoices: [{
        id: "invoice-sar",
        reference: "INV-SAR",
        status: "ISSUED",
        currency: "SAR",
        issueDate: new Date("2026-11-22T12:00:00.000Z"),
        dueDate: null,
        total: decimal("4200.00"),
        paidAmount: decimal("0.00"),
        payments: []
      }],
      supplierBills: []
    }
  ]
};

test("booking-file financial summary keeps each currency separate", () => {
  const result = summarizeBookingFileFinancials(record);
  assert.deepEqual(result.currencySummaries.map((item) => item.currency), ["EGP", "SAR"]);

  const egp = result.currencySummaries[0]!;
  assert.deepEqual(egp.estimates, {
    sales: "1250.10",
    costs: "1000.05",
    grossMargin: "250.05"
  });
  assert.deepEqual(egp.receivables, {
    invoiced: "1250.10",
    collected: "500.05",
    outstanding: "750.05"
  });
  assert.deepEqual(egp.payables, {
    billed: "800.00",
    paid: "300.00",
    outstanding: "500.00"
  });

  const sar = result.currencySummaries[1]!;
  assert.deepEqual(sar.estimates, {
    sales: "4200.00",
    costs: "3650.00",
    grossMargin: "550.00"
  });
  assert.deepEqual(sar.receivables, {
    invoiced: "4200.00",
    collected: "0.00",
    outstanding: "4200.00"
  });
  assert.deepEqual(sar.payables, {
    billed: "0.00",
    paid: "0.00",
    outstanding: "0.00"
  });
});

test("void financial documents remain visible but are excluded from balances", () => {
  const result = summarizeBookingFileFinancials(record);
  const egp = result.currencySummaries.find((item) => item.currency === "EGP");
  assert.equal(egp?.receivables.invoiced, "1250.10");
  const voidInvoice = result.reservations[0]?.invoices.find((invoice) => invoice.id === "invoice-void");
  assert.equal(voidInvoice?.includedInTotals, false);
  assert.equal(voidInvoice?.outstandingAmount, null);
});

test("financial summary retains documents attached to archived service lines", () => {
  const result = summarizeBookingFileFinancials(record);
  const archived = result.reservations.find((item) => item.id === "reservation-sar");
  assert.ok(archived?.archivedAt);
  assert.equal(archived?.invoices[0]?.reference, "INV-SAR");
});

test("supplier bills include their supplier reference and exact outstanding balance", () => {
  const result = summarizeBookingFileFinancials(record);
  const bill = result.reservations[0]?.supplierBills[0];
  assert.equal(bill?.supplier?.name, "Hotel Supplier");
  assert.equal(bill?.outstandingAmount, "500.00");
  assert.equal(bill?.includedInTotals, true);
});
