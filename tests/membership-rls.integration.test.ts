import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function isPostgresPermissionDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  if (error.code === "42501") return true;
  if (error.code !== "P2010" || !("meta" in error)) return false;
  const meta = error.meta;
  return typeof meta === "object" && meta !== null && "code" in meta && meta.code === "42501";
}

test("RLS prevents self-joining another tenant and creating memberships for other users", {
  skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APP_DATABASE_URL
}, async () => {
  const adminUrl = process.env.DATABASE_URL;
  const runtimeUrl = process.env.APP_DATABASE_URL;
  if (!adminUrl || !runtimeUrl) throw new Error("DATABASE_URL and APP_DATABASE_URL are required.");
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
  const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: runtimeUrl }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  const userId = "membership-rls-" + suffix;
  const otherUserId = "membership-other-" + suffix;
  let tenantA: string | undefined;
  let tenantB: string | undefined;

  try {
    await admin.user.createMany({ data: [
      { id: userId, name: "Tenant Owner", email: "membership-a-" + suffix + "@example.test" },
      { id: otherUserId, name: "Other User", email: "membership-b-" + suffix + "@example.test" }
    ] });
    const [a, b] = await Promise.all([
      admin.tenant.create({ data: { name: "Membership RLS A", slug: "member-a-" + suffix } }),
      admin.tenant.create({ data: { name: "Membership RLS B", slug: "member-b-" + suffix } })
    ]);
    tenantA = a.id;
    tenantB = b.id;
    await admin.tenantMembership.create({ data: { tenantId: a.id, userId, role: "OWNER" } });

    const attemptInsert = async (targetTenantId: string, targetUserId: string) => runtime.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT
        set_config('app.user_id', ${userId}, true),
        set_config('app.tenant_id', ${a.id}, true)
      `;
      await tx.$executeRaw`
        INSERT INTO "tenant_memberships"
          ("id", "tenantId", "userId", "role", "createdAt", "updatedAt")
        VALUES
          (${"forged-" + randomUUID()}, ${targetTenantId}, ${targetUserId}, 'OWNER'::"TenantRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    });

    await assert.rejects(
      attemptInsert(b.id, userId),
      isPostgresPermissionDenied
    );
    await assert.rejects(
      attemptInsert(a.id, otherUserId),
      isPostgresPermissionDenied
    );

    await assert.rejects(
      runtime.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.user_id', ${userId}, true),
          set_config('app.tenant_id', ${a.id}, true)
        `;
        await tx.$executeRaw`UPDATE "tenant_memberships" SET "role" = 'OWNER' WHERE "tenantId" = ${a.id} AND "userId" = ${userId}`;
      }),
      isPostgresPermissionDenied
    );

    const memberships = await admin.tenantMembership.findMany({
      where: { userId },
      select: { tenantId: true, role: true }
    });
    assert.deepEqual(memberships, [{ tenantId: a.id, role: "OWNER" }]);
  } finally {
    if (tenantA) await admin.tenant.delete({ where: { id: tenantA } });
    if (tenantB) await admin.tenant.delete({ where: { id: tenantB } });
    await admin.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await runtime.$disconnect();
    await admin.$disconnect();
  }
});
