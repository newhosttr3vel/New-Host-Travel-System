ALTER TABLE "journal_entries" ADD COLUMN "branchId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "branchId" TEXT;
ALTER TABLE "customer_payments" ADD COLUMN "branchId" TEXT;
ALTER TABLE "supplier_bills" ADD COLUMN "branchId" TEXT;
ALTER TABLE "supplier_payments" ADD COLUMN "branchId" TEXT;

UPDATE "invoices" i
SET "branchId" = COALESCE(r."branchId", b."id")
FROM "branches" b
LEFT JOIN "reservations" r ON r."id" = i."reservationId" AND r."tenantId" = i."tenantId"
WHERE b."tenantId" = i."tenantId" AND b."slug" = 'main';

UPDATE "supplier_bills" sb
SET "branchId" = COALESCE(r."branchId", b."id")
FROM "branches" b
LEFT JOIN "reservations" r ON r."id" = sb."reservationId" AND r."tenantId" = sb."tenantId"
WHERE b."tenantId" = sb."tenantId" AND b."slug" = 'main';

UPDATE "journal_entries" je
SET "branchId" = COALESCE(i."branchId", sb."branchId", b."id")
FROM "branches" b
LEFT JOIN "invoices" i ON i."journalEntryId" = je."id" AND i."tenantId" = je."tenantId"
LEFT JOIN "supplier_bills" sb ON sb."journalEntryId" = je."id" AND sb."tenantId" = je."tenantId"
WHERE b."tenantId" = je."tenantId" AND b."slug" = 'main';

UPDATE "customer_payments" cp
SET "branchId" = i."branchId"
FROM "invoices" i
WHERE i."id" = cp."invoiceId" AND i."tenantId" = cp."tenantId";

UPDATE "supplier_payments" sp
SET "branchId" = sb."branchId"
FROM "supplier_bills" sb
WHERE sb."id" = sp."supplierBillId" AND sb."tenantId" = sp."tenantId";

ALTER TABLE "journal_entries" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "customer_payments" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "supplier_bills" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "supplier_payments" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "journal_entries_tenantId_branchId_entryDate_idx" ON "journal_entries"("tenantId", "branchId", "entryDate");
CREATE INDEX "invoices_tenantId_branchId_issueDate_idx" ON "invoices"("tenantId", "branchId", "issueDate");
CREATE INDEX "customer_payments_tenantId_branchId_paymentDate_idx" ON "customer_payments"("tenantId", "branchId", "paymentDate");
CREATE INDEX "supplier_bills_tenantId_branchId_billDate_idx" ON "supplier_bills"("tenantId", "branchId", "billDate");
CREATE INDEX "supplier_payments_tenantId_branchId_paymentDate_idx" ON "supplier_payments"("tenantId", "branchId", "paymentDate");
