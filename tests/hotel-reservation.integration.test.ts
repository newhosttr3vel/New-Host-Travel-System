import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hotelReservationDetailsSchema, normalizeHotelReservation } from "../src/lib/hotel-pricing";

test("first hotel booking transaction persists the corporate client, hotel, supplier, room and nightly rates", {
  skip: process.env.RUN_DB_TESTS !== "true",
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the hotel reservation integration test.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14).toLowerCase();
  let cleanupTenantId: string | undefined;

  try {
    const tenant = await prisma.tenant.create({
      data: { name: "Hotel Reservation Integration", slug: `hotel-booking-${suffix}` },
    });
    const tenantId = tenant.id;
    cleanupTenantId = tenantId;

    const [customer, supplier, hotel] = await Promise.all([
      prisma.customer.create({
        data: { tenantId, type: "CORPORATE", name: "Test B2B Client", companyName: "Test Client Company" },
      }),
      prisma.supplier.create({
        data: { tenantId, name: "Test Hotel Supplier", category: "HOTEL" },
      }),
      prisma.hotel.create({
        data: { tenantId, name: "Test Hotel Property", city: "Makkah", country: "Saudi Arabia" },
      }),
    ]);

    const details = hotelReservationDetailsSchema.parse({
      hotelId: hotel.id,
      guestName: "Test Guest",
      guestNationality: "Egyptian",
      isManualRate: true,
      pricesIncludeVat: false,
      rooms: [{
        roomCount: 1,
        roomType: "Standard Double",
        mealPlan: "BB",
        adults: 2,
        children: 0,
        rates: [{
          stayDate: "2026-12-10",
          saleRoomRate: "100.00",
          saleMealRatePerPax: "20.00",
          saleVat: "15.00",
          costRoomRate: "70.00",
          costMealRatePerPax: "10.00",
          costVat: "10.00",
        }],
      }],
    });
    const pricing = normalizeHotelReservation(details, "2026-12-10", "2026-12-11", true);

    const created = await prisma.$transaction(async (tx) => {
      const selectedCustomer = await tx.customer.findFirst({
        where: { id: customer.id, tenantId, archivedAt: null },
        select: { id: true, nationality: true, type: true },
      });
      assert.equal(selectedCustomer?.type, "CORPORATE");

      const selectedSupplier = await tx.supplier.findFirst({
        where: { id: supplier.id, tenantId, archivedAt: null },
        select: { id: true, category: true },
      });
      assert.equal(selectedSupplier?.category, "HOTEL");

      const selectedHotel = await tx.hotel.findFirst({
        where: { id: hotel.id, tenantId, archivedAt: null },
        select: { id: true, name: true },
      });
      assert.ok(selectedHotel);

      const reservation = await tx.reservation.create({
        data: {
          tenantId,
          customerId: selectedCustomer!.id,
          supplierId: selectedSupplier!.id,
          supplierTenantId: tenantId,
          reference: `NHT-TEST-${suffix}`,
          serviceType: "HOTEL",
          status: "INQUIRY",
          startDate: new Date("2026-12-10T12:00:00.000Z"),
          endDate: new Date("2026-12-11T12:00:00.000Z"),
          currency: "EGP",
          saleAmount: pricing.saleAmount,
          costAmount: pricing.costAmount,
          notes: null,
          hotelDetail: {
            create: {
              tenant: { connect: { id: tenantId } },
              hotel: {
                connect: { id_tenantId: { id: selectedHotel!.id, tenantId } },
              },
              hotelName: selectedHotel!.name,
              clientNationality: selectedCustomer!.nationality,
              guestName: details.guestName,
              guestNationality: details.guestNationality || null,
              isManualRate: details.isManualRate,
              pricesIncludeVat: details.pricesIncludeVat,
              rooms: {
                create: pricing.rooms.map((room) => ({
                  tenant: { connect: { id: tenantId } },
                  roomCount: room.roomCount,
                  roomType: room.roomType,
                  mealPlan: room.mealPlan,
                  adults: room.adults,
                  children: room.children,
                  sortOrder: room.sortOrder,
                  nightlyRates: {
                    create: room.rates.map((rate) => ({
                      tenant: { connect: { id: tenantId } },
                      stayDate: rate.stayDate,
                      saleRoomRate: rate.saleRoomRate,
                      saleMealRatePerPax: rate.saleMealRatePerPax,
                      saleVat: rate.saleVat,
                      costRoomRate: rate.costRoomRate,
                      costMealRatePerPax: rate.costMealRatePerPax,
                      costVat: rate.costVat,
                    })),
                  },
                })),
              },
            },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          action: "RESERVATION_CREATED",
          entityType: "Reservation",
          entityId: reservation.id,
          metadata: { reference: reservation.reference },
        },
      });

      const loaded = await tx.reservation.findUnique({
        where: { id: reservation.id },
        include: {
          customer: true,
          supplier: true,
          hotelDetail: {
            include: { rooms: { include: { nightlyRates: true } } },
          },
        },
      });
      assert.ok(loaded);
      return loaded;
    });

    assert.equal(created.serviceType, "HOTEL");
    assert.equal(created.customer.id, customer.id);
    assert.equal(created.supplier?.id, supplier.id);
    assert.equal(created.hotelDetail?.hotelId, hotel.id);
    assert.equal(created.hotelDetail?.rooms.length, 1);
    assert.equal(created.hotelDetail?.rooms[0]?.nightlyRates.length, 1);
    assert.equal(created.saleAmount.toString(), "155");
    assert.equal(created.costAmount.toString(), "100");
  } finally {
    if (cleanupTenantId) await prisma.tenant.delete({ where: { id: cleanupTenantId } });
    await prisma.$disconnect();
  }
});
