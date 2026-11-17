import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

test("booking files group service reservations without breaking standalone reservation writes", {
  skip: process.env.RUN_DB_TESTS !== "true"
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the booking-file integration test.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  let tenantA: string | undefined;
  let tenantB: string | undefined;

  try {
    const [a, b] = await Promise.all([
      prisma.tenant.create({ data: { name: "Booking File Tenant A", slug: "booking-file-a-" + suffix } }),
      prisma.tenant.create({ data: { name: "Booking File Tenant B", slug: "booking-file-b-" + suffix } })
    ]);
    tenantA = a.id;
    tenantB = b.id;

    const [customerA, customerB] = await Promise.all([
      prisma.customer.create({ data: { tenantId: a.id, type: "CORPORATE", name: "B2B Client A" } }),
      prisma.customer.create({ data: { tenantId: b.id, type: "CORPORATE", name: "B2B Client B" } })
    ]);
    const [fileA, fileB] = await Promise.all([
      prisma.bookingFile.create({
        data: { tenantId: a.id, customerId: customerA.id, reference: "NHT-BF-A-" + suffix }
      }),
      prisma.bookingFile.create({
        data: { tenantId: b.id, customerId: customerB.id, reference: "NHT-BF-B-" + suffix }
      })
    ]);

    const service = await prisma.reservation.create({
      data: {
        tenantId: a.id,
        customerId: customerA.id,
        bookingFileId: fileA.id,
        reference: "NHT-SERVICE-" + suffix,
        serviceType: "FLIGHT",
        saleAmount: "1200.00",
        costAmount: "1000.00"
      }
    });
    assert.equal(service.bookingFileId, fileA.id);

    const loadedFile = await prisma.bookingFile.findUnique({
      where: { id_tenantId: { id: fileA.id, tenantId: a.id } },
      include: { reservations: { select: { id: true, serviceType: true, saleAmount: true, costAmount: true } } }
    });
    assert.equal(loadedFile?.reservations.length, 1);
    assert.equal(loadedFile?.reservations[0]?.id, service.id);
    assert.equal(loadedFile?.reservations[0]?.serviceType, "FLIGHT");
    assert.equal(loadedFile?.reservations[0]?.saleAmount.toString(), "1200");
    assert.equal(loadedFile?.reservations[0]?.costAmount.toString(), "1000");

    await assert.rejects(prisma.reservation.create({
      data: {
        tenantId: a.id,
        customerId: customerA.id,
        bookingFileId: fileB.id,
        reference: "NHT-CROSS-TENANT-" + suffix,
        serviceType: "VISA"
      }
    }));

    // The nullable relation keeps older reservation creation flows compatible during rollout.
    const standalone = await prisma.reservation.create({
      data: {
        tenantId: a.id,
        customerId: customerA.id,
        reference: "NHT-STANDALONE-" + suffix,
        serviceType: "HOTEL"
      }
    });
    assert.equal(standalone.bookingFileId, null);
  } finally {
    if (tenantA) await prisma.reservation.deleteMany({ where: { tenantId: tenantA } });
    if (tenantB) await prisma.reservation.deleteMany({ where: { tenantId: tenantB } });
    if (tenantA) await prisma.bookingFile.deleteMany({ where: { tenantId: tenantA } });
    if (tenantB) await prisma.bookingFile.deleteMany({ where: { tenantId: tenantB } });
    if (tenantA) await prisma.tenant.delete({ where: { id: tenantA } });
    if (tenantB) await prisma.tenant.delete({ where: { id: tenantB } });
    await prisma.$disconnect();
  }
});
