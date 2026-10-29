CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "CustomerPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'ELECTRONIC_WALLET', 'THNDR', 'OTHER');

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_id_tenantId_key" UNIQUE ("id", "tenantId");

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "reservationId" TEXT,
  "journalEntryId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL,
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_amounts_check" CHECK (
    "subtotal" > 0 AND "taxAmount" >= 0 AND "total" = "subtotal" + "taxAmount"
    AND "paidAmount" >= 0 AND "paidAmount" <= "total"
  ),
  CONSTRAINT "invoices_exchange_rate_positive" CHECK ("exchangeRate" > 0),
  CONSTRAINT "invoices_currency_iso_length" CHECK (char_length("currency") = 3),
  CONSTRAINT "invoices_payment_status_check" CHECK (
    ("status" = 'ISSUED' AND "paidAmount" = 0) OR
    ("status" = 'PARTIALLY_PAID' AND "paidAmount" > 0 AND "paidAmount" < "total") OR
    ("status" = 'PAID' AND "paidAmount" = "total") OR
    ("status" = 'VOID')
  )
);
CREATE UNIQUE INDEX "invoices_id_tenantId_key" ON "invoices"("id", "tenantId");
CREATE UNIQUE INDEX "invoices_tenantId_reference_key" ON "invoices"("tenantId", "reference");
CREATE UNIQUE INDEX "invoices_tenantId_idempotencyKey_key" ON "invoices"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "invoices_tenantId_journalEntryId_key" ON "invoices"("tenantId", "journalEntryId");
CREATE INDEX "invoices_tenantId_status_issueDate_idx" ON "invoices"("tenantId", "status", "issueDate");
CREATE INDEX "invoices_tenantId_customerId_issueDate_idx" ON "invoices"("tenantId", "customerId", "issueDate");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId") REFERENCES "customers"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reservationId_tenantId_fkey"
  FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_journalEntryId_tenantId_fkey"
  FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "journal_entries"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "invoice_lines" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "revenueAccountId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_lines_amount_check" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "amount" > 0)
);
CREATE INDEX "invoice_lines_tenantId_invoiceId_idx" ON "invoice_lines"("tenantId", "invoiceId");
CREATE INDEX "invoice_lines_tenantId_revenueAccountId_idx" ON "invoice_lines"("tenantId", "revenueAccountId");
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_tenantId_fkey"
  FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "invoices"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_revenueAccountId_tenantId_fkey"
  FOREIGN KEY ("revenueAccountId", "tenantId") REFERENCES "ledger_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "customer_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "method" "CustomerPaymentMethod" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "customer_payments_exchange_rate_positive" CHECK ("exchangeRate" > 0),
  CONSTRAINT "customer_payments_currency_iso_length" CHECK (char_length("currency") = 3)
);
CREATE UNIQUE INDEX "customer_payments_id_tenantId_key" ON "customer_payments"("id", "tenantId");
CREATE UNIQUE INDEX "customer_payments_tenantId_receiptNumber_key" ON "customer_payments"("tenantId", "receiptNumber");
CREATE UNIQUE INDEX "customer_payments_tenantId_idempotencyKey_key" ON "customer_payments"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "customer_payments_tenantId_journalEntryId_key" ON "customer_payments"("tenantId", "journalEntryId");
CREATE INDEX "customer_payments_tenantId_paymentDate_idx" ON "customer_payments"("tenantId", "paymentDate");
CREATE INDEX "customer_payments_tenantId_invoiceId_paymentDate_idx" ON "customer_payments"("tenantId", "invoiceId", "paymentDate");
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_invoiceId_tenantId_fkey"
  FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "invoices"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_accountId_tenantId_fkey"
  FOREIGN KEY ("accountId", "tenantId") REFERENCES "ledger_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_journalEntryId_tenantId_fkey"
  FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "journal_entries"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;

INSERT INTO "ledger_accounts"
  ("id", "tenantId", "code", "name", "nameEn", "type", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, tenant."id", '2200', 'ضريبة القيمة المضافة المستحقة', 'VAT payable', 'LIABILITY', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" AS tenant
ON CONFLICT ("tenantId", "code") DO NOTHING;
