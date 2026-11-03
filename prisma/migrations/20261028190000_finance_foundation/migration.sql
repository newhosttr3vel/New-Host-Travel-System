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
ALTER TABLE "journal_entries" ADD COLUMN "reversalOfId" TEXT;
CREATE UNIQUE INDEX "journal_entries_tenantId_reversalOfId_key" ON "journal_entries"("tenantId", "reversalOfId");
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId", "tenantId") REFERENCES "journal_entries"("id", "tenantId") ON DELETE NO ACTION ON UPDATE CASCADE;
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



-- Initialize the chart of accounts for workspaces that existed before this migration.
INSERT INTO "ledger_accounts"
  ("id", "tenantId", "code", "name", "nameEn", "type", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, tenant."id", account.code, account.name, account.name_en, account.type, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" AS tenant
CROSS JOIN (VALUES
  ('1000', 'النقدية', 'Cash', 'ASSET'::"LedgerAccountType"),
  ('1010', 'البنك', 'Bank', 'ASSET'::"LedgerAccountType"),
  ('1020', 'المحافظ الإلكترونية', 'Electronic wallets', 'ASSET'::"LedgerAccountType"),
  ('1030', 'محفظة ثاندر', 'Thndr brokerage', 'ASSET'::"LedgerAccountType"),
  ('1100', 'العملاء - مدينون', 'Accounts receivable', 'ASSET'::"LedgerAccountType"),
  ('1200', 'دفعات مقدمة للموردين', 'Supplier advances', 'ASSET'::"LedgerAccountType"),
  ('2000', 'الموردون - دائنون', 'Accounts payable', 'LIABILITY'::"LedgerAccountType"),
  ('2100', 'دفعات مقدمة من العملاء', 'Customer advances', 'LIABILITY'::"LedgerAccountType"),
  ('3000', 'رأس مال المالك', 'Owner capital', 'EQUITY'::"LedgerAccountType"),
  ('3100', 'الأرباح المحتجزة', 'Retained earnings', 'EQUITY'::"LedgerAccountType"),
  ('4000', 'إيرادات خدمات السفر', 'Travel service revenue', 'REVENUE'::"LedgerAccountType"),
  ('4100', 'إيرادات العمولات', 'Commission revenue', 'REVENUE'::"LedgerAccountType"),
  ('4200', 'أرباح فروق العملة', 'Foreign exchange gains', 'REVENUE'::"LedgerAccountType"),
  ('5000', 'تكلفة خدمات الموردين', 'Supplier service costs', 'EXPENSE'::"LedgerAccountType"),
  ('5100', 'مصروفات بنكية', 'Bank charges', 'EXPENSE'::"LedgerAccountType"),
  ('5200', 'مصروفات تشغيلية', 'Operating expenses', 'EXPENSE'::"LedgerAccountType"),
  ('5300', 'خسائر فروق العملة', 'Foreign exchange losses', 'EXPENSE'::"LedgerAccountType")
) AS account(code, name, name_en, type)
ON CONFLICT ("tenantId", "code") DO NOTHING;

-- Deferred constraint triggers validate the final transaction state, after all
-- journal lines in the posting transaction have been inserted.
CREATE OR REPLACE FUNCTION assert_journal_entry_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id TEXT;
  v_tenant_id TEXT;
  v_status "JournalEntryStatus";
  v_line_count BIGINT;
  v_debit NUMERIC;
  v_credit NUMERIC;
  v_base_debit NUMERIC;
  v_base_credit NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'journal_lines' THEN
    IF TG_OP = 'DELETE' THEN
      v_entry_id := OLD."journalEntryId";
      v_tenant_id := OLD."tenantId";
    ELSE
      v_entry_id := NEW."journalEntryId";
      v_tenant_id := NEW."tenantId";
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_entry_id := OLD."id";
      v_tenant_id := OLD."tenantId";
    ELSE
      v_entry_id := NEW."id";
      v_tenant_id := NEW."tenantId";
    END IF;
  END IF;

  SELECT "status" INTO v_status
  FROM "journal_entries"
  WHERE "id" = v_entry_id AND "tenantId" = v_tenant_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*),
         COALESCE(SUM("debit"), 0),
         COALESCE(SUM("credit"), 0),
         COALESCE(SUM("baseDebit"), 0),
         COALESCE(SUM("baseCredit"), 0)
    INTO v_line_count, v_debit, v_credit, v_base_debit, v_base_credit
  FROM "journal_lines"
  WHERE "journalEntryId" = v_entry_id AND "tenantId" = v_tenant_id;

  IF v_status = 'POSTED' AND
     (v_line_count < 2 OR v_debit <> v_credit OR v_base_debit <> v_base_credit) THEN
    RAISE EXCEPTION 'Journal entry % must contain at least two balanced lines in both transaction and base currency.', v_entry_id
      USING ERRCODE = '23514', CONSTRAINT = 'journal_entries_balance_check';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER journal_entries_balance_constraint
AFTER INSERT OR UPDATE ON "journal_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_journal_entry_balanced();

CREATE CONSTRAINT TRIGGER journal_lines_balance_constraint
AFTER INSERT OR UPDATE OR DELETE ON "journal_lines"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_journal_entry_balanced();
