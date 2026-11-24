CREATE TYPE "VisaApplicationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ISSUED',
  'REJECTED',
  'CANCELLED'
);
CREATE TYPE "VisaEntryType" AS ENUM ('SINGLE', 'DOUBLE', 'MULTIPLE');

CREATE TABLE "visa_reservation_details" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "destinationCountryCode" TEXT NOT NULL,
  "visaType" TEXT NOT NULL,
  "entryType" "VisaEntryType" NOT NULL DEFAULT 'SINGLE',
  "status" "VisaApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "applicationReference" TEXT,
  "submittedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3),
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "stayDurationDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visa_reservation_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visa_reservation_details_id_tenantId_key"
  ON "visa_reservation_details"("id", "tenantId");
CREATE UNIQUE INDEX "visa_reservation_details_reservationId_tenantId_key"
  ON "visa_reservation_details"("reservationId", "tenantId");
CREATE INDEX "visa_reservation_details_tenantId_status_createdAt_idx"
  ON "visa_reservation_details"("tenantId", "status", "createdAt");
CREATE INDEX "visa_reservation_details_tenantId_destinationCountryCode_status_idx"
  ON "visa_reservation_details"("tenantId", "destinationCountryCode", "status");
CREATE INDEX "visa_reservation_details_tenantId_applicationReference_idx"
  ON "visa_reservation_details"("tenantId", "applicationReference");

ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_reservation_details_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_reservation_details_reservationId_tenantId_fkey"
  FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "visa_applicants" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "visaDetailId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "nationality" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visa_applicants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visa_applicants_id_tenantId_key"
  ON "visa_applicants"("id", "tenantId");
CREATE INDEX "visa_applicants_tenantId_visaDetailId_fullName_idx"
  ON "visa_applicants"("tenantId", "visaDetailId", "fullName");

ALTER TABLE "visa_applicants"
  ADD CONSTRAINT "visa_applicants_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visa_applicants"
  ADD CONSTRAINT "visa_applicants_visaDetailId_tenantId_fkey"
  FOREIGN KEY ("visaDetailId", "tenantId") REFERENCES "visa_reservation_details"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_destination_country_code_check"
  CHECK ("destinationCountryCode" ~ '^[A-Z]{2}$');
ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_type_not_blank_check"
  CHECK (length(trim("visaType")) >= 2);
ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_stay_duration_positive_check"
  CHECK ("stayDurationDays" IS NULL OR "stayDurationDays" > 0);
ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_validity_window_check"
  CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" >= "validFrom");
ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_issued_requires_dates_check"
  CHECK ("status" <> 'ISSUED' OR (
    "issuedAt" IS NOT NULL AND "validFrom" IS NOT NULL AND "validUntil" IS NOT NULL
  ));
ALTER TABLE "visa_reservation_details"
  ADD CONSTRAINT "visa_submitted_requires_timestamp_check"
  CHECK ("status" <> 'SUBMITTED' OR "submittedAt" IS NOT NULL);

ALTER TABLE "visa_applicants"
  ADD CONSTRAINT "visa_applicant_name_not_blank_check"
  CHECK (length(trim("fullName")) >= 2);
ALTER TABLE "visa_applicants"
  ADD CONSTRAINT "visa_applicant_nationality_check"
  CHECK ("nationality" IS NULL OR "nationality" ~ '^[A-Z]{2}$');

ALTER TABLE public.visa_reservation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_reservation_details FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.visa_reservation_details
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = visa_reservation_details."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = visa_reservation_details."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

ALTER TABLE public.visa_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_applicants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.visa_applicants
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = visa_applicants."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = visa_applicants."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.visa_reservation_details,
  public.visa_applicants
TO new_host_app;
