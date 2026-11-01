-- Add detailed hotel reservation data without altering existing reservation records.
CREATE TABLE "hotel_reservation_details" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "hotelName" TEXT,
  "clientNationality" TEXT,
  "guestName" TEXT NOT NULL,
  "guestNationality" TEXT,
  "guestPhone" TEXT,
  "rateCode" TEXT,
  "clientOptionDate" TIMESTAMP(3),
  "hotelOptionDate" TIMESTAMP(3),
  "termsAndConditions" TEXT,
  "generalPolicy" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fileNo" TEXT,
  "reservationRemarks" TEXT,
  "roomNumber" TEXT,
  "hotelConfirmationNumber" TEXT,
  "voucher" TEXT,
  "referenceNumber" TEXT,
  "detailRemarks" TEXT,
  "agreementNumber" TEXT,
  "costCenter" TEXT,
  "hotelRemarks" TEXT,
  "company" TEXT,
  "subClient" TEXT,
  "salesperson" TEXT,
  "channel" TEXT,
  "clientRemarks" TEXT,
  "bank" TEXT,
  "paymentMethod" TEXT,
  "isManualRate" BOOLEAN NOT NULL DEFAULT false,
  "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hotel_reservation_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hotel_reservation_details_id_tenantId_key" ON "hotel_reservation_details"("id", "tenantId");
CREATE UNIQUE INDEX "hotel_reservation_details_reservationId_tenantId_key" ON "hotel_reservation_details"("reservationId", "tenantId");
CREATE INDEX "hotel_reservation_details_tenantId_fileNo_idx" ON "hotel_reservation_details"("tenantId", "fileNo");
CREATE INDEX "hotel_reservation_details_tenantId_hotelName_idx" ON "hotel_reservation_details"("tenantId", "hotelName");
ALTER TABLE "hotel_reservation_details" ADD CONSTRAINT "hotel_reservation_details_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_reservation_details" ADD CONSTRAINT "hotel_reservation_details_reservationId_tenantId_fkey"
  FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hotel_reservation_rooms" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "hotelDetailId" TEXT NOT NULL,
  "roomCount" INTEGER NOT NULL DEFAULT 1,
  "roomType" TEXT NOT NULL,
  "mealPlan" TEXT NOT NULL,
  "adults" INTEGER NOT NULL DEFAULT 1,
  "children" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hotel_reservation_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotel_reservation_rooms_id_tenantId_key" ON "hotel_reservation_rooms"("id", "tenantId");
CREATE INDEX "hotel_reservation_rooms_tenantId_hotelDetailId_sortOrder_idx"
  ON "hotel_reservation_rooms"("tenantId", "hotelDetailId", "sortOrder");
ALTER TABLE "hotel_reservation_rooms" ADD CONSTRAINT "hotel_reservation_rooms_hotelDetailId_tenantId_fkey"
  FOREIGN KEY ("hotelDetailId", "tenantId") REFERENCES "hotel_reservation_details"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hotel_reservation_night_rates" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "stayDate" TIMESTAMP(3) NOT NULL,
  "saleRoomRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "saleMealRatePerPax" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "saleVat" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "costRoomRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "costMealRatePerPax" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "costVat" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hotel_reservation_night_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotel_reservation_night_rates_tenantId_roomId_stayDate_key"
  ON "hotel_reservation_night_rates"("tenantId", "roomId", "stayDate");
CREATE INDEX "hotel_reservation_night_rates_tenantId_stayDate_idx"
  ON "hotel_reservation_night_rates"("tenantId", "stayDate");
ALTER TABLE "hotel_reservation_night_rates" ADD CONSTRAINT "hotel_reservation_night_rates_roomId_tenantId_fkey"
  FOREIGN KEY ("roomId", "tenantId") REFERENCES "hotel_reservation_rooms"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
