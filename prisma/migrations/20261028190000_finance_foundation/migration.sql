CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "JournalEntryStatus" AS ENUM ('POSTED');
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'INVOICE', 'SUPPLIER_BILL', 'REVERSAL');

CREATE TABLE "ledger_accounts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "type" "LedgerAccountType" NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ledger_accounts_id_tenantId_key" ON "ledger_accounts"("id", "tenantId");
CREATE UNIQUE INDEX "ledger_accounts_tenantId_code_key" ON "ledger_accounts"("tenantId", "code");
CREATE INDEX "ledger_accounts_tenantId_type_isActive_idx" ON "ledger_accounts"("tenantId", "type", "isActive");
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "journal_entries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
  "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
  "idempotencyKey" TEXT,
  "requestHash" TEXT,
  "createdById" TEXT,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_entries_exchange_rate_positive" CHECK ("exchangeRate" > 0),
  CONSTRAINT "journal_entries_currency_iso_length" CHECK (char_length("currency") = 3)
);
CREATE UNIQUE INDEX "journal_entries_id_tenantId_key" ON "journal_entries"("id", "tenantId");
CREATE UNIQUE INDEX "journal_entries_tenantId_reference_key" ON "journal_entries"("tenantId", "reference");
CREATE UNIQUE INDEX "journal_entries_tenantId_idempotencyKey_key" ON "journal_entries"("tenantId", "idempotencyKey");
CREATE INDEX "journal_entries_tenantId_entryDate_status_idx" ON "journal_entries"("tenantId", "entryDate", "status");
CREATE INDEX "journal_entries_tenantId_sourceType_entryDate_idx" ON "journal_entries"("tenantId", "sourceType", "entryDate");
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "journal_lines" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "memo" TEXT,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "baseDebit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "baseCredit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_lines_one_side_only" CHECK (
    ("debit" >= 0 AND "credit" >= 0) AND
    (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
  ),
  CONSTRAINT "journal_lines_base_one_side_only" CHECK (
    ("baseDebit" >= 0 AND "baseCredit" >= 0) AND
    (("baseDebit" > 0 AND "baseCredit" = 0) OR ("baseCredit" > 0 AND "baseDebit" = 0))
  )
);
CREATE INDEX "journal_lines_tenantId_journalEntryId_idx" ON "journal_lines"("tenantId", "journalEntryId");
CREATE INDEX "journal_lines_tenantId_accountId_idx" ON "journal_lines"("tenantId", "accountId");
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_tenantId_fkey"
  FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "journal_entries"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_tenantId_fkey"
  FOREIGN KEY ("accountId", "tenantId") REFERENCES "ledger_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
