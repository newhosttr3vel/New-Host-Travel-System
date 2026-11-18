CREATE TABLE "booking_files" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "customerId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "booking_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_files_id_tenantId_key" ON "booking_files"("id", "tenantId");
CREATE UNIQUE INDEX "booking_files_id_customerId_tenantId_key" ON "booking_files"("id", "customerId", "tenantId");
CREATE UNIQUE INDEX "booking_files_tenantId_reference_key" ON "booking_files"("tenantId", "reference");
CREATE INDEX "booking_files_tenantId_customerId_createdAt_idx" ON "booking_files"("tenantId", "customerId", "createdAt");
CREATE INDEX "booking_files_tenantId_branchId_createdAt_idx" ON "booking_files"("tenantId", "branchId", "createdAt");

ALTER TABLE "booking_files"
  ADD CONSTRAINT "booking_files_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_files"
  ADD CONSTRAINT "booking_files_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_files"
  ADD CONSTRAINT "booking_files_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId") REFERENCES "customers"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations" ADD COLUMN "bookingFileId" TEXT;

-- Preserve every legacy reservation and all financial/service references.
-- One deterministic master file is created per existing service reservation.
INSERT INTO "booking_files"
  ("id", "tenantId", "branchId", "customerId", "reference", "createdAt", "updatedAt", "archivedAt")
SELECT
  'bf_' || r."id",
  r."tenantId",
  r."branchId",
  r."customerId",
  r."reference",
  r."createdAt",
  r."updatedAt",
  r."archivedAt"
FROM "reservations" r;

UPDATE "reservations"
SET "bookingFileId" = 'bf_' || "id";

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_bookingFileId_customerId_tenantId_fkey"
  FOREIGN KEY ("bookingFileId", "customerId", "tenantId") REFERENCES "booking_files"("id", "customerId", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "reservations_tenantId_bookingFileId_idx"
  ON "reservations"("tenantId", "bookingFileId");

-- The migration-level RLS loop ran before this table existed, so enroll it explicitly.
ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_files FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.booking_files
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships m
      WHERE m."tenantId" = booking_files."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships m
      WHERE m."tenantId" = booking_files."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_files TO new_host_app;
