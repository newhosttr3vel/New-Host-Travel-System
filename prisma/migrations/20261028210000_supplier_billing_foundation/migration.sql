CREATE TYPE "SupplierBillStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

CREATE TABLE "supplier_bills" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "reservationId" TEXT,
  "journalEntryId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "supplierReference" TEXT,
  "billDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" "SupplierBillStatus" NOT NULL DEFAULT 'ISSUED',
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
  CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_bills_amounts_check" CHECK (
    "subtotal" > 0 AND "taxAmount" >= 0 AND "total" = "subtotal" + "taxAmount"
    AND "paidAmount" >= 0 AND "paidAmount" <= "total"
  ),
  CONSTRAINT "supplier_bills_exchange_rate_positive" CHECK ("exchangeRate" > 0),
  CONSTRAINT "supplier_bills_currency_iso_length" CHECK (char_length("currency") = 3),
  CONSTRAINT "supplier_bills_payment_status_check" CHECK (
    ("status" = 'ISSUED' AND "paidAmount" = 0) OR
    ("status" = 'PARTIALLY_PAID' AND "paidAmount" > 0 AND "paidAmount" < "total") OR
    ("status" = 'PAID' AND "paidAmount" = "total") OR
    ("status" = 'VOID')
  )
);
CREATE UNIQUE INDEX "supplier_bills_id_tenantId_key" ON "supplier_bills"("id", "tenantId");
CREATE UNIQUE INDEX "supplier_bills_tenantId_reference_key" ON "supplier_bills"("tenantId", "reference");
CREATE UNIQUE INDEX "supplier_bills_tenantId_idempotencyKey_key" ON "supplier_bills"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "supplier_bills_tenantId_journalEntryId_key" ON "supplier_bills"("tenantId", "journalEntryId");
CREATE INDEX "supplier_bills_tenantId_status_billDate_idx" ON "supplier_bills"("tenantId", "status", "billDate");
CREATE INDEX "supplier_bills_tenantId_supplierId_billDate_idx" ON "supplier_bills"("tenantId", "supplierId", "billDate");
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_supplierId_tenantId_fkey"
  FOREIGN KEY ("supplierId", "tenantId") REFERENCES "suppliers"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_reservationId_tenantId_fkey"
  FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_journalEntryId_tenantId_fkey"
  FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "journal_entries"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "supplier_bill_lines" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierBillId" TEXT NOT NULL,
  "expenseAccountId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_bill_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_bill_lines_amount_check" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "amount" > 0)
);
CREATE INDEX "supplier_bill_lines_tenantId_supplierBillId_idx" ON "supplier_bill_lines"("tenantId", "supplierBillId");
CREATE INDEX "supplier_bill_lines_tenantId_expenseAccountId_idx" ON "supplier_bill_lines"("tenantId", "expenseAccountId");
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "supplier_bill_lines_supplierBillId_tenantId_fkey"
  FOREIGN KEY ("supplierBillId", "tenantId") REFERENCES "supplier_bills"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "supplier_bill_lines_expenseAccountId_tenantId_fkey"
  FOREIGN KEY ("expenseAccountId", "tenantId") REFERENCES "ledger_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "supplier_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierBillId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "paymentNumber" TEXT NOT NULL,
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
  CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "supplier_payments_exchange_rate_positive" CHECK ("exchangeRate" > 0),
  CONSTRAINT "supplier_payments_currency_iso_length" CHECK (char_length("currency") = 3)
);
CREATE UNIQUE INDEX "supplier_payments_id_tenantId_key" ON "supplier_payments"("id", "tenantId");
CREATE UNIQUE INDEX "supplier_payments_tenantId_paymentNumber_key" ON "supplier_payments"("tenantId", "paymentNumber");
CREATE UNIQUE INDEX "supplier_payments_tenantId_idempotencyKey_key" ON "supplier_payments"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "supplier_payments_tenantId_journalEntryId_key" ON "supplier_payments"("tenantId", "journalEntryId");
CREATE INDEX "supplier_payments_tenantId_paymentDate_idx" ON "supplier_payments"("tenantId", "paymentDate");
CREATE INDEX "supplier_payments_tenantId_supplierBillId_paymentDate_idx" ON "supplier_payments"("tenantId", "supplierBillId", "paymentDate");
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierBillId_tenantId_fkey"
  FOREIGN KEY ("supplierBillId", "tenantId") REFERENCES "supplier_bills"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_accountId_tenantId_fkey"
  FOREIGN KEY ("accountId", "tenantId") REFERENCES "ledger_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_journalEntryId_tenantId_fkey"
  FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "journal_entries"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;

INSERT INTO "ledger_accounts"
  ("id", "tenantId", "code", "name", "nameEn", "type", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, tenant."id", '1300', 'ضريبة القيمة المضافة القابلة للاسترداد', 'Recoverable VAT', 'ASSET', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" AS tenant
ON CONFLICT ("tenantId", "code") DO NOTHING;
