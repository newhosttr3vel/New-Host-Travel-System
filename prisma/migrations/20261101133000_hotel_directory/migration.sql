-- Separate the hotel directory from the companies that supply hotel inventory.
CREATE TABLE "hotels" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "country" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotels_id_tenantId_key" ON "hotels"("id", "tenantId");
CREATE UNIQUE INDEX "hotels_tenantId_name_key" ON "hotels"("tenantId", "name");
CREATE INDEX "hotels_tenantId_archivedAt_name_idx" ON "hotels"("tenantId", "archivedAt", "name");
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hotel_reservation_details" ADD COLUMN "hotelId" TEXT;
CREATE INDEX "hotel_reservation_details_tenantId_hotelId_idx"
  ON "hotel_reservation_details"("tenantId", "hotelId");
ALTER TABLE "hotel_reservation_details" ADD CONSTRAINT "hotel_reservation_details_hotelId_tenantId_fkey"
  FOREIGN KEY ("hotelId", "tenantId") REFERENCES "hotels"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
