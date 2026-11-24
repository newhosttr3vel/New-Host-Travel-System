import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

test("booking-file multi-service creation is atomic and enforces one customer per file", {
  skip: process.env.RUN_DB_TESTS !== "true"
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the booking-file create integration test.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  let tenantId: string | undefined;

  try {
    const tenant = await prisma.tenant.create({
      data: { name: "Booking File Create Tenant", slug: "booking-file-create-" + suffix }
    });
    tenantId = tenant.id;
    const currentTenantId = tenant.id;

    const [customer, otherCustomer] = await Promise.all([
      prisma.customer.create({
        data: { tenantId: currentTenantId, type: "CORPORATE", name: "Booking File B2B Customer" }
      }),
      prisma.customer.create({
        data: { tenantId: currentTenantId, type: "CORPORATE", name: "Different B2B Customer" }
      })
    ]);

    const successfulReference = "NHT-BF-CREATE-" + suffix;
    const created = await prisma.$transaction(async (tx) => {
      const file = await tx.bookingFile.create({
        data: { tenantId: currentTenantId, customerId: customer.id, reference: successfulReference }
      });
      const services = [];
      const serviceTypes = ["HOTEL", "FLIGHT", "UMRAH_PACKAGE"] as const;
      for (const [index, serviceType] of serviceTypes.entries()) {
        services.push(await tx.reservation.create({
          data: {
            tenantId: currentTenantId,
            customerId: customer.id,
            bookingFileId: file.id,
            reference: "NHT-BF-SVC-" + index + "-" + suffix,
            serviceType,
            saleAmount: "1000.00",
            costAmount: "800.00"
          },
          select: { id: true, serviceType: true, bookingFileId: true }
        }));
      }
      return { file, services };
    });

    assert.equal(created.services.length, 3);
    assert.ok(created.services.every((service) => service.bookingFileId === created.file.id));
    assert.deepEqual(
      created.services.map((service) => service.serviceType),
      ["HOTEL", "FLIGHT", "UMRAH_PACKAGE"]
    );

    const flightReservation = created.services.find((service) => service.serviceType === "FLIGHT");
    assert.ok(flightReservation, "The booking file must contain a flight service.");
    await prisma.flightReservationDetail.create({
      data: {
        tenantId: currentTenantId,
        reservationId: flightReservation.id,
        bookingReference: "PNR" + suffix.slice(0, 6).toUpperCase(),
        segments: {
          create: [{
            segmentOrder: 0,
            carrierCode: "MS",
            flightNumber: "985",
            originCode: "CAI",
            destinationCode: "JED",
            departureAt: new Date("2026-12-20T06:00:00.000Z"),
            arrivalAt: new Date("2026-12-20T09:00:00.000Z"),
            cabinClass: "ECONOMY"
          }]
        },
        passengers: {
          create: [{
            fullName: "Integration Test Passenger",
            passengerType: "ADULT"
          }]
        }
      }
    });
    const savedFlight = await prisma.flightReservationDetail.findFirst({
      where: { tenantId: currentTenantId, reservationId: flightReservation.id },
      include: { segments: true, passengers: true }
    });
    assert.equal(savedFlight?.segments.length, 1);
    assert.equal(savedFlight?.segments[0]?.originCode, "CAI");
    assert.equal(savedFlight?.segments[0]?.destinationCode, "JED");
    assert.equal(savedFlight?.passengers.length, 1);
    assert.equal(savedFlight?.passengers[0]?.ticketStatus, "PENDING");

    const failedReference = "NHT-BF-ROLLBACK-" + suffix;
    await assert.rejects(prisma.$transaction(async (tx) => {
      const file = await tx.bookingFile.create({
        data: { tenantId: currentTenantId, customerId: customer.id, reference: failedReference }
      });
      await tx.reservation.create({
        data: {
          tenantId: currentTenantId,
          customerId: otherCustomer.id,
          bookingFileId: file.id,
          reference: "NHT-BF-CROSS-CUSTOMER-" + suffix,
          serviceType: "VISA"
        }
      });
    }));

    const rolledBackFile = await prisma.bookingFile.findFirst({
      where: { tenantId: currentTenantId, reference: failedReference },
      select: { id: true }
    });
    assert.equal(rolledBackFile, null, "A failed service insert must roll back the master booking file.");
  } finally {
    if (tenantId) await prisma.reservation.deleteMany({ where: { tenantId } });
    if (tenantId) await prisma.bookingFile.deleteMany({ where: { tenantId } });
    if (tenantId) await prisma.customer.deleteMany({ where: { tenantId } });
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});


test("booking-file idempotency serializes retries and is isolated by tenant", {
  skip: process.env.RUN_DB_TESTS !== "true"
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the booking-file idempotency integration test.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  let tenantAId: string | undefined;
  let tenantBId: string | undefined;

  try {
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { name: "Booking Idempotency A", slug: "booking-idem-a-" + suffix } }),
      prisma.tenant.create({ data: { name: "Booking Idempotency B", slug: "booking-idem-b-" + suffix } })
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [customerA, customerB] = await Promise.all([
      prisma.customer.create({ data: { tenantId: tenantA.id, type: "CORPORATE", name: "Idempotency Customer A" } }),
      prisma.customer.create({ data: { tenantId: tenantB.id, type: "CORPORATE", name: "Idempotency Customer B" } })
    ]);

    const idempotencyKey = randomUUID();
    const requestHash = "a".repeat(64);
    const createOrReplay = async (
      tenantId: string,
      customerId: string,
      reference: string,
      hash: string
    ) => prisma.$transaction(async (tx) => {
      const lockKey = "booking-file:" + tenantId + ":" + idempotencyKey;
      await tx.$queryRaw<{ acquired: boolean }[]>`
        WITH lock_result AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        )
        SELECT TRUE AS acquired FROM lock_result
      `;
      const previous = await tx.bookingFile.findFirst({
        where: { tenantId, idempotencyKey }
      });
      if (previous) {
        return { item: previous, replay: true, conflict: previous.requestHash !== hash };
      }
      const item = await tx.bookingFile.create({
        data: { tenantId, customerId, reference, idempotencyKey, requestHash: hash }
      });
      return { item, replay: false, conflict: false };
    });

    const [first, retry] = await Promise.all([
      createOrReplay(tenantA.id, customerA.id, "NHT-IDEM-FIRST-" + suffix, requestHash),
      createOrReplay(tenantA.id, customerA.id, "NHT-IDEM-RETRY-" + suffix, requestHash)
    ]);
    assert.equal(first.item.id, retry.item.id, "Concurrent retries must resolve to the same booking file.");
    assert.equal([first, retry].filter((result) => result.replay).length, 1);
    assert.equal(first.conflict || retry.conflict, false);

    const changedPayload = await createOrReplay(
      tenantA.id,
      customerA.id,
      "NHT-IDEM-CHANGED-" + suffix,
      "b".repeat(64)
    );
    assert.equal(changedPayload.conflict, true);
    assert.equal(changedPayload.item.id, first.item.id);

    const sameKeyInOtherTenant = await createOrReplay(
      tenantB.id,
      customerB.id,
      "NHT-IDEM-TENANT-B-" + suffix,
      "b".repeat(64)
    );
    assert.equal(sameKeyInOtherTenant.replay, false);
    assert.equal(sameKeyInOtherTenant.item.tenantId, tenantB.id);

    await Promise.all([
      prisma.bookingFile.create({
        data: { tenantId: tenantA.id, customerId: customerA.id, reference: "NHT-LEGACY-NULL-A-" + suffix }
      }),
      prisma.bookingFile.create({
        data: { tenantId: tenantA.id, customerId: customerA.id, reference: "NHT-LEGACY-NULL-B-" + suffix }
      })
    ]);
    const legacyNullCount = await prisma.bookingFile.count({
      where: { tenantId: tenantA.id, idempotencyKey: null }
    });
    assert.equal(legacyNullCount, 2, "Legacy booking files must remain compatible with nullable idempotency fields.");

    await assert.rejects(
      prisma.bookingFile.create({
        data: {
          tenantId: tenantA.id,
          customerId: customerA.id,
          reference: "NHT-IDEM-DUPLICATE-" + suffix,
          idempotencyKey,
          requestHash
        }
      }),
      (error: unknown) => Boolean(
        error && typeof error === "object" && "code" in error && error.code === "P2002"
      )
    );
  } finally {
    if (tenantAId) {
      await prisma.bookingFile.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.customer.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.tenant.delete({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prisma.bookingFile.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.customer.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.tenant.delete({ where: { id: tenantBId } });
    }
    await prisma.$disconnect();
  }
});
