import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

test("PostgreSQL blocks reservation links across tenant boundaries", { skip: process.env.RUN_DB_TESTS !== "true" }, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the tenant-isolation integration test.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  let firstTenantId: string | undefined;
  let secondTenantId: string | undefined;
  const unique = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  try {
    const firstTenant = await prisma.tenant.create({
      data: { name: "Tenant Isolation Test A", slug: `isolation-a-${unique}` }
    });
    firstTenantId = firstTenant.id;
    const secondTenant = await prisma.tenant.create({
      data: { name: "Tenant Isolation Test B", slug: `isolation-b-${unique}` }
    });
    secondTenantId = secondTenant.id;
    const firstCustomer = await prisma.customer.create({
      data: { tenantId: firstTenant.id, name: "Test Customer A" }
    });
    const secondCustomer = await prisma.customer.create({
      data: { tenantId: secondTenant.id, name: "Test Customer B" }
    });
    const secondSupplier = await prisma.supplier.create({
      data: { tenantId: secondTenant.id, name: "Test Supplier B" }
    });

    await assert.rejects(prisma.reservation.create({
      data: {
        tenantId: firstTenant.id,
        customerId: secondCustomer.id,
        reference: `CROSS-CUSTOMER-${unique}`,
        serviceType: "HOTEL"
      }
    }));

    await assert.rejects(prisma.reservation.create({
      data: {
        tenantId: firstTenant.id,
        customerId: firstCustomer.id,
        supplierId: secondSupplier.id,
        reference: `CROSS-SUPPLIER-${unique}`,
        serviceType: "HOTEL"
      }
    }));

    const valid = await prisma.reservation.create({
      data: {
        tenantId: firstTenant.id,
        customerId: firstCustomer.id,
        reference: `VALID-${unique}`,
        serviceType: "HOTEL",
        saleAmount: "100.00",
        costAmount: "80.00"
      }
    });
    assert.equal(valid.tenantId, firstTenant.id);
    assert.equal(valid.customerId, firstCustomer.id);
  } finally {
    if (firstTenantId) await prisma.tenant.delete({ where: { id: firstTenantId } });
    if (secondTenantId) await prisma.tenant.delete({ where: { id: secondTenantId } });
    await prisma.$disconnect();
  }
});
