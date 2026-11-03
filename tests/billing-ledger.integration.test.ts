import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const decimal = (value: { toString(): string } | string | number) => Number(value.toString());

test("invoice issuance and customer receipt flow remain balanced and tenant-isolated", {
  skip: process.env.RUN_DB_TESTS !== "true"
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the billing integration test.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  const createdTenantIds: string[] = [];
  try {
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { name: "Billing Test A", slug: "billing-a-" + suffix } }),
      prisma.tenant.create({ data: { name: "Billing Test B", slug: "billing-b-" + suffix } })
    ]);
    createdTenantIds.push(tenantA.id, tenantB.id);

    const [customerA, customerB] = await Promise.all([
      prisma.customer.create({ data: { tenantId: tenantA.id, name: "Billing Customer A" } }),
      prisma.customer.create({ data: { tenantId: tenantB.id, name: "Billing Customer B" } })
    ]);
    const [ar, cash, revenue, vat] = await Promise.all([
      prisma.ledgerAccount.create({ data: { tenantId: tenantA.id, code: "AR-" + suffix, name: "عملاء", nameEn: "Receivables", type: "ASSET" } }),
      prisma.ledgerAccount.create({ data: { tenantId: tenantA.id, code: "CASH-" + suffix, name: "نقدية", nameEn: "Cash", type: "ASSET" } }),
      prisma.ledgerAccount.create({ data: { tenantId: tenantA.id, code: "REV-" + suffix, name: "إيرادات", nameEn: "Revenue", type: "REVENUE" } }),
      prisma.ledgerAccount.create({ data: { tenantId: tenantA.id, code: "VAT-" + suffix, name: "ضريبة", nameEn: "VAT payable", type: "LIABILITY" } })
    ]);

    const issued = await prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.create({
        data: {
          tenantId: tenantA.id, reference: "INV-J-" + suffix,
          entryDate: new Date("2026-10-28T12:00:00.000Z"),
          description: "Test invoice issuance", currency: "EGP", exchangeRate: "1",
          status: "POSTED", sourceType: "INVOICE",
          idempotencyKey: "invoice:test:" + suffix, requestHash: "test-invoice-" + suffix
        }
      });
      await tx.journalLine.createMany({ data: [
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: ar.id, debit: "115.00", credit: "0", baseDebit: "115.00", baseCredit: "0" },
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: revenue.id, debit: "0", credit: "100.00", baseDebit: "0", baseCredit: "100.00" },
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: vat.id, debit: "0", credit: "15.00", baseDebit: "0", baseCredit: "15.00" }
      ] });
      const invoice = await tx.invoice.create({ data: {
        tenantId: tenantA.id, customerId: customerA.id, journalEntryId: journal.id,
        reference: "INV-" + suffix, issueDate: new Date("2026-10-28T12:00:00.000Z"),
        status: "ISSUED", currency: "EGP", exchangeRate: "1",
        subtotal: "100.00", taxAmount: "15.00", total: "115.00", paidAmount: "0.00",
        idempotencyKey: "invoice-key-" + suffix, requestHash: "invoice-hash-" + suffix
      } });
      await tx.invoiceLine.create({ data: {
        tenantId: tenantA.id, invoiceId: invoice.id, revenueAccountId: revenue.id,
        description: "Travel service", quantity: "1.00", unitPrice: "100.00", amount: "100.00"
      } });
      return { invoice, journal };
    });
    assert.equal(issued.invoice.status, "ISSUED");
    assert.equal(decimal(issued.invoice.total), 115);
    assert.equal(decimal(issued.invoice.paidAmount), 0);

    const paid = await prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.create({
        data: {
          tenantId: tenantA.id, reference: "RCPT-J-" + suffix,
          entryDate: new Date("2026-10-28T12:00:00.000Z"),
          description: "Test partial collection", currency: "EGP", exchangeRate: "1",
          status: "POSTED", sourceType: "CUSTOMER_PAYMENT",
          idempotencyKey: "payment:test:" + suffix, requestHash: "test-payment-" + suffix
        }
      });
      await tx.journalLine.createMany({ data: [
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: cash.id, debit: "40.00", credit: "0", baseDebit: "40.00", baseCredit: "0" },
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: ar.id, debit: "0", credit: "40.00", baseDebit: "0", baseCredit: "40.00" }
      ] });
      const payment = await tx.customerPayment.create({ data: {
        tenantId: tenantA.id, invoiceId: issued.invoice.id, accountId: cash.id, journalEntryId: journal.id,
        receiptNumber: "RCT-" + suffix, paymentDate: new Date("2026-10-28T12:00:00.000Z"),
        method: "CASH", amount: "40.00", currency: "EGP", exchangeRate: "1",
        idempotencyKey: "receipt-key-" + suffix, requestHash: "receipt-hash-" + suffix
      } });
      const update = await tx.invoice.update({ where: { id: issued.invoice.id }, data: { status: "PARTIALLY_PAID", paidAmount: "40.00" } });
      return { payment, invoice: update };
    });
    assert.equal(decimal(paid.payment.amount), 40);
    assert.equal(paid.invoice.status, "PARTIALLY_PAID");
    assert.equal(decimal(paid.invoice.paidAmount), 40);
    assert.equal(115 - decimal(paid.invoice.paidAmount), 75);

    const journalLines = await prisma.journalLine.findMany({ where: { tenantId: tenantA.id } });
    const debit = journalLines.reduce((sum, line) => sum + decimal(line.baseDebit), 0);
    const credit = journalLines.reduce((sum, line) => sum + decimal(line.baseCredit), 0);
    assert.equal(debit, 155);
    assert.equal(credit, 155);

    const crossTenantJournal = await prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.create({
        data: {
          tenantId: tenantA.id, reference: "CROSS-J-" + suffix,
          entryDate: new Date("2026-10-28T12:00:00.000Z"), description: "Cross-tenant invoice guard",
          currency: "EGP", exchangeRate: "1", status: "POSTED", sourceType: "MANUAL",
          idempotencyKey: "cross-tenant-journal-" + suffix, requestHash: "cross-tenant-" + suffix
        }
      });
      await tx.journalLine.createMany({ data: [
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: ar.id, debit: "1.00", credit: "0", baseDebit: "1.00", baseCredit: "0" },
        { tenantId: tenantA.id, journalEntryId: journal.id, accountId: revenue.id, debit: "0", credit: "1.00", baseDebit: "0", baseCredit: "1.00" }
      ] });
      return journal;
    });
    await assert.rejects(prisma.invoice.create({ data: {
      tenantId: tenantA.id, customerId: customerB.id, journalEntryId: crossTenantJournal.id,
      reference: "BAD-INV-" + suffix, issueDate: new Date("2026-10-28T12:00:00.000Z"),
      currency: "EGP", exchangeRate: "1", subtotal: "1.00", taxAmount: "0.00", total: "1.00",
      paidAmount: "0.00", idempotencyKey: "bad-invoice-" + suffix, requestHash: "bad-hash-" + suffix
    } }));
  } finally {
    for (const tenantId of createdTenantIds) {
      await prisma.customerPayment.deleteMany({ where: { tenantId } });
      await prisma.invoice.deleteMany({ where: { tenantId } });
      await prisma.journalEntry.deleteMany({ where: { tenantId } });
      await prisma.ledgerAccount.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.$disconnect();
  }
});
