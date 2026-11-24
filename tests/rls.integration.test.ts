import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { prisma, withTenantRlsContext } from "../src/lib/prisma";

test("PostgreSQL RLS denies cross-company reads and writes for a non-owner runtime login", {
  skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APP_DATABASE_URL
}, async () => {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("DATABASE_URL is required for RLS test setup.");
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  const userId = "rls-test-" + suffix;
  const email = "rls-" + suffix + "@example.test";
  let tenantA: string | undefined;
  let tenantB: string | undefined;
  try {
    await admin.user.create({ data: { id: userId, name: "RLS Test", email, emailVerified: true } });
    const [a, b] = await Promise.all([
      admin.tenant.create({ data: { name: "RLS Tenant A", slug: "rlsa-" + suffix } }),
      admin.tenant.create({ data: { name: "RLS Tenant B", slug: "rlsb-" + suffix } })
    ]);
    tenantA = a.id;
    tenantB = b.id;
    await admin.tenantMembership.create({ data: { tenantId: a.id, userId, role: "OWNER" } });
    const [customerA, customerB] = await Promise.all([
      admin.customer.create({ data: { tenantId: a.id, name: "Visible Customer" } }),
      admin.customer.create({ data: { tenantId: b.id, name: "Hidden Customer" } })
    ]);
    await admin.bookingFile.create({
      data: { tenantId: b.id, customerId: customerB.id, reference: "RLS-HIDDEN-" + suffix }
    });

    const [flightReservationA, flightReservationB] = await Promise.all([
      admin.reservation.create({
        data: {
          tenantId: a.id,
          customerId: customerA.id,
          reference: "RLS-FLIGHT-A-" + suffix,
          serviceType: "FLIGHT"
        }
      }),
      admin.reservation.create({
        data: {
          tenantId: b.id,
          customerId: customerB.id,
          reference: "RLS-FLIGHT-B-" + suffix,
          serviceType: "FLIGHT"
        }
      })
    ]);
    const createFlightDetail = (tenantId: string, reservationId: string, bookingReference: string) =>
      admin.flightReservationDetail.create({
        data: {
          tenantId,
          reservationId,
          bookingReference,
          segments: {
            create: [{
              segmentOrder: 0,
              carrierCode: "MS",
              flightNumber: "985",
              originCode: "CAI",
              destinationCode: "JED",
              departureAt: new Date("2026-12-20T06:00:00.000Z"),
              arrivalAt: new Date("2026-12-20T09:00:00.000Z")
            }]
          },
          passengers: {
            create: [{ fullName: "RLS Test Passenger" }]
          }
        }
      });
    await Promise.all([
      createFlightDetail(a.id, flightReservationA.id, "RLS-A-" + suffix),
      createFlightDetail(b.id, flightReservationB.id, "RLS-B-" + suffix)
    ]);

    await withTenantRlsContext({ userId, tenantId: a.id }, async () => {
      const visible = await prisma.customer.findMany({ where: { tenantId: a.id }, select: { name: true } });
      assert.deepEqual(visible.map((item) => item.name), ["Visible Customer"]);
      const bookingFile = await prisma.bookingFile.create({
        data: { tenantId: a.id, customerId: customerA.id, reference: "RLS-VISIBLE-" + suffix }
      });
      const visibleFiles = await prisma.bookingFile.findMany({
        where: { tenantId: a.id },
        select: { id: true, reference: true }
      });
      assert.deepEqual(visibleFiles, [{ id: bookingFile.id, reference: bookingFile.reference }]);

      const visibleFlightDetails = await prisma.flightReservationDetail.findMany({
        where: { tenantId: a.id },
        select: { bookingReference: true }
      });
      assert.deepEqual(visibleFlightDetails.map((item) => item.bookingReference), ["RLS-A-" + suffix]);
      const visibleSegments = await prisma.flightSegment.findMany({
        where: { tenantId: a.id },
        select: { flightNumber: true }
      });
      assert.deepEqual(visibleSegments.map((item) => item.flightNumber), ["985"]);
      const visiblePassengers = await prisma.flightPassenger.findMany({
        where: { tenantId: a.id },
        select: { fullName: true }
      });
      assert.deepEqual(visiblePassengers.map((item) => item.fullName), ["RLS Test Passenger"]);

      await assert.rejects(
        prisma.customer.findMany({ where: { tenantId: b.id } }),
        /switch company context/
      );
      await prisma.$transaction(async (tx) => {
        const rawRows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM customers WHERE "tenantId" = ${b.id}`;
        assert.equal(rawRows.length, 0);
        const hiddenBookingFiles = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM booking_files WHERE "tenantId" = ${b.id}`;
        assert.equal(hiddenBookingFiles.length, 0);
        const hiddenFlightDetails = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM flight_reservation_details WHERE "tenantId" = ${b.id}`;
        assert.equal(hiddenFlightDetails.length, 0);
        const hiddenFlightSegments = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM flight_segments WHERE "tenantId" = ${b.id}`;
        assert.equal(hiddenFlightSegments.length, 0);
        const hiddenFlightPassengers = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM flight_passengers WHERE "tenantId" = ${b.id}`;
        assert.equal(hiddenFlightPassengers.length, 0);
        await assert.rejects(
          tx.customer.create({ data: { tenantId: b.id, name: "Cross-company insert" } }),
          /switch company context/
        );
      });

      const auditEvent = await prisma.auditEvent.create({
        data: {
          tenantId: a.id,
          userId,
          action: "RLS_TEST_EVENT",
          entityType: "SecurityTest",
          entityId: suffix
        }
      });
      await assert.rejects(
        prisma.auditEvent.update({
          where: { id: auditEvent.id },
          data: { action: "MUTATED_EVENT" }
        })
      );
      await assert.rejects(
        prisma.auditEvent.delete({ where: { id: auditEvent.id } })
      );
      const unchangedEvent = await admin.auditEvent.findUnique({ where: { id: auditEvent.id } });
      assert.equal(unchangedEvent?.action, "RLS_TEST_EVENT");
    });
  } finally {
    if (tenantA) await admin.reservation.deleteMany({ where: { tenantId: tenantA } });
    if (tenantB) await admin.reservation.deleteMany({ where: { tenantId: tenantB } });
    if (tenantA) await admin.bookingFile.deleteMany({ where: { tenantId: tenantA } });
    if (tenantB) await admin.bookingFile.deleteMany({ where: { tenantId: tenantB } });
    if (tenantA) await admin.tenant.delete({ where: { id: tenantA } });
    if (tenantB) await admin.tenant.delete({ where: { id: tenantB } });
    await admin.user.deleteMany({ where: { id: userId } });
    await admin.$disconnect();
    await prisma.$disconnect();
  }
});
