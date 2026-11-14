import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function isPostgresPermissionDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "42501") return true;
  const messages: string[] = [];
  if ("message" in error && typeof error.message === "string") messages.push(error.message);
  if ("meta" in error && typeof error.meta === "object" && error.meta !== null) {
    const meta = error.meta as Record<string, unknown>;
    if (typeof meta.code === "string") messages.push(meta.code);
    if (typeof meta.message === "string") messages.push(meta.message);
  }
  const combined = messages.join(" ");
  return combined.includes("42501") ||
    combined.includes("row-level security policy") ||
    combined.includes("permission denied for table");
}

test("RLS permits owner-managed employee memberships and blocks unauthorized membership changes", {
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
  const unauthorizedUserId = "membership-unauthorized-" + suffix;
  const unauthorizedTargetId = "membership-target-" + suffix;
  let tenantA: string | undefined;
  let tenantB: string | undefined;

  try {
    await admin.user.createMany({ data: [
      { id: userId, name: "Tenant Owner", email: "membership-a-" + suffix + "@example.test" },
      { id: otherUserId, name: "Employee", email: "membership-b-" + suffix + "@example.test" },
      { id: unauthorizedUserId, name: "Non Owner", email: "membership-c-" + suffix + "@example.test" },
      { id: unauthorizedTargetId, name: "Unauthorized Target", email: "membership-d-" + suffix + "@example.test" }
    ] });
    const [a, b] = await Promise.all([
      admin.tenant.create({ data: { name: "Membership RLS A", slug: "member-a-" + suffix } }),
      admin.tenant.create({ data: { name: "Membership RLS B", slug: "member-b-" + suffix } })
    ]);
    tenantA = a.id;
    tenantB = b.id;
    await admin.tenantMembership.create({ data: { tenantId: a.id, userId, role: "OWNER" } });

    const attemptInsert = async (
      actorUserId: string,
      contextTenantId: string,
      targetTenantId: string,
      targetUserId: string
    ) => runtime.$transaction(async (tx) => {
      await tx.$executeRaw\`SELECT
        set_config('app.user_id', ${actorUserId}, true),
        set_config('app.tenant_id', ${contextTenantId}, true)
      \`;
      await tx.$executeRaw\`
        INSERT INTO "tenant_memberships"
          ("id", "tenantId", "userId", "role", "createdAt", "updatedAt")
        VALUES
          (${"forged-" + randomUUID()}, ${targetTenantId}, ${targetUserId}, 'EMPLOYEE'::"TenantRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      \`;
    });

    await assert.rejects(
      attemptInsert(userId, a.id, b.id, userId),
      isPostgresPermissionDenied
    );
    // A tenant OWNER is allowed to add another user to their own tenant.
    await attemptInsert(userId, a.id, a.id, otherUserId);

    // A regular non-member cannot add users, even when targeting that tenant.
    await assert.rejects(
      attemptInsert(unauthorizedUserId, a.id, a.id, unauthorizedTargetId),
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
    assert.deepEqual(memberships, [
      { tenantId: a.id, role: "OWNER" },
      { tenantId: a.id, role: "EMPLOYEE" },
    ]);
  } finally {
    if (tenantA) await admin.tenant.delete({ where: { id: tenantA } });
    if (tenantB) await admin.tenant.delete({ where: { id: tenantB } });
    await admin.user.deleteMany({ where: { id: { in: [userId, otherUserId, unauthorizedUserId, unauthorizedTargetId] } } });
    await runtime.$disconnect();
    await admin.$disconnect();
  }
});
