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

    const [customer, otherCustomer] = await Promise.all([
      prisma.customer.create({
        data: { tenantId, type: "CORPORATE", name: "Booking File B2B Customer" }
      }),
      prisma.customer.create({
        data: { tenantId, type: "CORPORATE", name: "Different B2B Customer" }
      })
    ]);

    const successfulReference = "NHT-BF-CREATE-" + suffix;
    const created = await prisma.$transaction(async (tx) => {
      const file = await tx.bookingFile.create({
        data: { tenantId, customerId: customer.id, reference: successfulReference }
      });
      const services = [];
      for (const [index, serviceType] of ["HOTEL", "FLIGHT", "UMRAH_PACKAGE"] as const.entries()) {
        services.push(await tx.reservation.create({
          data: {
            tenantId,
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

    const failedReference = "NHT-BF-ROLLBACK-" + suffix;
    await assert.rejects(prisma.$transaction(async (tx) => {
      const file = await tx.bookingFile.create({
        data: { tenantId, customerId: customer.id, reference: failedReference }
      });
      await tx.reservation.create({
        data: {
          tenantId,
          customerId: otherCustomer.id,
          bookingFileId: file.id,
          reference: "NHT-BF-CROSS-CUSTOMER-" + suffix,
          serviceType: "VISA"
        }
      });
    }));

    const rolledBackFile = await prisma.bookingFile.findFirst({
      where: { tenantId, reference: failedReference },
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
