CREATE TYPE "PilgrimagePackageType" AS ENUM ('UMRAH', 'HAJJ');
CREATE TYPE "PilgrimageTravellerType" AS ENUM ('ADULT', 'CHILD', 'INFANT');
CREATE TYPE "PilgrimageAccommodationLevel" AS ENUM ('THREE_STAR', 'FOUR_STAR', 'FIVE_STAR', 'LUXURY', 'OTHER');
CREATE TYPE "PilgrimageMealPlan" AS ENUM ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD');

CREATE TABLE "pilgrimage_package_reservation_details" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "packageType" "PilgrimagePackageType" NOT NULL,
  "packageName" TEXT NOT NULL,
  "departureCity" TEXT NOT NULL,
  "departureDate" TIMESTAMP(3) NOT NULL,
  "returnDate" TIMESTAMP(3) NOT NULL,
  "groupReference" TEXT,
  "accommodationLevel" "PilgrimageAccommodationLevel" NOT NULL DEFAULT 'FOUR_STAR',
  "mealPlan" "PilgrimageMealPlan" NOT NULL DEFAULT 'BREAKFAST',
  "transportIncluded" BOOLEAN NOT NULL DEFAULT false,
  "includedServices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pilgrimage_package_reservation_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pilgrimage_package_reservation_details_id_tenantId_key"
  ON "pilgrimage_package_reservation_details"("id", "tenantId");
CREATE UNIQUE INDEX "pilgrimage_package_reservation_details_reservationId_tenantId_key"
  ON "pilgrimage_package_reservation_details"("reservationId", "tenantId");
CREATE INDEX "pilgrimage_package_reservation_details_tenantId_packageType_departureDate_idx"
  ON "pilgrimage_package_reservation_details"("tenantId", "packageType", "departureDate");
CREATE INDEX "pilgrimage_package_reservation_details_tenantId_groupReference_idx"
  ON "pilgrimage_package_reservation_details"("tenantId", "groupReference");

ALTER TABLE "pilgrimage_package_reservation_details"
  ADD CONSTRAINT "pilgrimage_package_reservation_details_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pilgrimage_package_reservation_details"
  ADD CONSTRAINT "pilgrimage_package_reservation_details_reservationId_tenantId_fkey"
  FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pilgrimage_package_reservation_details"
  ADD CONSTRAINT "pilgrimage_package_name_not_blank_check"
  CHECK (length(trim("packageName")) >= 2);
ALTER TABLE "pilgrimage_package_reservation_details"
  ADD CONSTRAINT "pilgrimage_departure_city_not_blank_check"
  CHECK (length(trim("departureCity")) >= 2);
ALTER TABLE "pilgrimage_package_reservation_details"
  ADD CONSTRAINT "pilgrimage_return_after_departure_check"
  CHECK ("returnDate" > "departureDate");

CREATE TABLE "pilgrimage_package_travellers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "packageDetailId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "travellerType" "PilgrimageTravellerType" NOT NULL DEFAULT 'ADULT',
  "nationality" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pilgrimage_package_travellers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pilgrimage_package_travellers_id_tenantId_key"
  ON "pilgrimage_package_travellers"("id", "tenantId");
CREATE INDEX "pilgrimage_package_travellers_tenantId_packageDetailId_fullName_idx"
  ON "pilgrimage_package_travellers"("tenantId", "packageDetailId", "fullName");

ALTER TABLE "pilgrimage_package_travellers"
  ADD CONSTRAINT "pilgrimage_package_travellers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pilgrimage_package_travellers"
  ADD CONSTRAINT "pilgrimage_package_travellers_packageDetailId_tenantId_fkey"
  FOREIGN KEY ("packageDetailId", "tenantId")
  REFERENCES "pilgrimage_package_reservation_details"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pilgrimage_package_travellers"
  ADD CONSTRAINT "pilgrimage_package_traveller_name_not_blank_check"
  CHECK (length(trim("fullName")) >= 2);
ALTER TABLE "pilgrimage_package_travellers"
  ADD CONSTRAINT "pilgrimage_package_traveller_nationality_check"
  CHECK ("nationality" IS NULL OR "nationality" ~ '^[A-Z]{2}$');

ALTER TABLE public.pilgrimage_package_reservation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilgrimage_package_reservation_details FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.pilgrimage_package_reservation_details
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = pilgrimage_package_reservation_details."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = pilgrimage_package_reservation_details."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

ALTER TABLE public.pilgrimage_package_travellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilgrimage_package_travellers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.pilgrimage_package_travellers
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = pilgrimage_package_travellers."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = pilgrimage_package_travellers."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.pilgrimage_package_reservation_details,
  public.pilgrimage_package_travellers
TO new_host_app;
