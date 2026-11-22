ALTER TABLE "booking_files"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "booking_files_tenantId_idempotencyKey_key"
  ON "booking_files"("tenantId", "idempotencyKey");

ALTER TABLE "booking_files"
  ADD CONSTRAINT "booking_files_idempotency_pair_check"
  CHECK (
    ("idempotencyKey" IS NULL AND "requestHash" IS NULL)
    OR ("idempotencyKey" IS NOT NULL AND "requestHash" IS NOT NULL)
  );
