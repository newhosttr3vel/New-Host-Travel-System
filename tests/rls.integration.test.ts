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
    await admin.customer.createMany({ data: [
      { tenantId: a.id, name: "Visible Customer" },
      { tenantId: b.id, name: "Hidden Customer" }
    ] });

    await withTenantRlsContext({ userId, tenantId: a.id }, async () => {
      const visible = await prisma.customer.findMany({ where: { tenantId: a.id }, select: { name: true } });
      assert.deepEqual(visible.map((item) => item.name), ["Visible Customer"]);
      await assert.rejects(
        prisma.customer.findMany({ where: { tenantId: b.id } }),
        /switch company context/
      );
      await prisma.$transaction(async (tx) => {
        const rawRows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM customers WHERE "tenantId" = ${b.id}`;
        assert.equal(rawRows.length, 0);
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
      await assert.rejects(
        admin.auditEvent.update({
          where: { id: auditEvent.id },
          data: { action: "ADMIN_MUTATION" }
        }),
        /audit_events is append-only/
      );
      const unchangedEvent = await admin.auditEvent.findUnique({ where: { id: auditEvent.id } });
      assert.equal(unchangedEvent?.action, "RLS_TEST_EVENT");
    });
  } finally {
    if (tenantA) await admin.tenant.delete({ where: { id: tenantA } });
    if (tenantB) await admin.tenant.delete({ where: { id: tenantB } });
    await admin.user.deleteMany({ where: { id: userId } });
    await admin.$disconnect();
    await prisma.$disconnect();
  }
});
