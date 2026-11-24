CREATE TYPE "FlightPassengerType" AS ENUM ('ADULT', 'CHILD', 'INFANT');
CREATE TYPE "FlightCabinClass" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');
CREATE TYPE "FlightTicketStatus" AS ENUM ('PENDING', 'ISSUED', 'VOIDED');

CREATE TABLE "flight_reservation_details" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "bookingReference" TEXT,
  "ticketingDeadline" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flight_reservation_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flight_reservation_details_id_tenantId_key"
  ON "flight_reservation_details"("id", "tenantId");
CREATE UNIQUE INDEX "flight_reservation_details_reservationId_tenantId_key"
  ON "flight_reservation_details"("reservationId", "tenantId");
CREATE INDEX "flight_reservation_details_tenantId_bookingReference_idx"
  ON "flight_reservation_details"("tenantId", "bookingReference");

ALTER TABLE "flight_reservation_details"
  ADD CONSTRAINT "flight_reservation_details_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flight_reservation_details"
  ADD CONSTRAINT "flight_reservation_details_reservationId_tenantId_fkey"
  FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "flight_segments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "flightDetailId" TEXT NOT NULL,
  "segmentOrder" INTEGER NOT NULL,
  "carrierCode" TEXT NOT NULL,
  "flightNumber" TEXT NOT NULL,
  "originCode" TEXT NOT NULL,
  "destinationCode" TEXT NOT NULL,
  "departureAt" TIMESTAMP(3) NOT NULL,
  "arrivalAt" TIMESTAMP(3) NOT NULL,
  "cabinClass" "FlightCabinClass" NOT NULL DEFAULT 'ECONOMY',
  "baggageAllowance" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flight_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flight_segments_id_tenantId_key"
  ON "flight_segments"("id", "tenantId");
CREATE UNIQUE INDEX "flight_segments_tenantId_flightDetailId_segmentOrder_key"
  ON "flight_segments"("tenantId", "flightDetailId", "segmentOrder");
CREATE INDEX "flight_segments_tenantId_departureAt_idx"
  ON "flight_segments"("tenantId", "departureAt");

ALTER TABLE "flight_segments"
  ADD CONSTRAINT "flight_segments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flight_segments"
  ADD CONSTRAINT "flight_segments_flightDetailId_tenantId_fkey"
  FOREIGN KEY ("flightDetailId", "tenantId") REFERENCES "flight_reservation_details"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "flight_passengers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "flightDetailId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "passengerType" "FlightPassengerType" NOT NULL DEFAULT 'ADULT',
  "nationality" TEXT,
  "ticketNumber" TEXT,
  "ticketStatus" "FlightTicketStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flight_passengers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flight_passengers_id_tenantId_key"
  ON "flight_passengers"("id", "tenantId");
CREATE INDEX "flight_passengers_tenantId_flightDetailId_fullName_idx"
  ON "flight_passengers"("tenantId", "flightDetailId", "fullName");
CREATE INDEX "flight_passengers_tenantId_ticketStatus_idx"
  ON "flight_passengers"("tenantId", "ticketStatus");

ALTER TABLE "flight_passengers"
  ADD CONSTRAINT "flight_passengers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flight_passengers"
  ADD CONSTRAINT "flight_passengers_flightDetailId_tenantId_fkey"
  FOREIGN KEY ("flightDetailId", "tenantId") REFERENCES "flight_reservation_details"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.flight_reservation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_reservation_details FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.flight_reservation_details
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = flight_reservation_details."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = flight_reservation_details."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

ALTER TABLE public.flight_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_segments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.flight_segments
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = flight_segments."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = flight_segments."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

ALTER TABLE public.flight_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_passengers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.flight_passengers
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = flight_passengers."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = flight_passengers."tenantId"
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.flight_reservation_details,
  public.flight_segments,
  public.flight_passengers
TO new_host_app;
