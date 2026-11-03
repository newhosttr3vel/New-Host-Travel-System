import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createWorkspaceForUser } from "../src/lib/workspace-onboarding";

test("parallel onboarding requests create at most one workspace for a user", {
  skip: process.env.RUN_DB_TESTS !== "true",
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the onboarding integration test.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14).toLowerCase();
  const userId = `onboarding-test-${suffix}`;
  const email = `onboarding-${suffix}@example.test`;
  let tenantId: string | undefined;

  try {
    await prisma.user.create({
      data: { id: userId, name: "Onboarding Test", email, emailVerified: true },
    });

    const input = {
      userId,
      companyName: "Concurrent Onboarding Test",
      defaultCurrency: "EGP" as const,
      defaultLanguage: "ar" as const,
      timeZone: "Africa/Cairo",
    };
    const results = await Promise.all([
      createWorkspaceForUser(input),
      createWorkspaceForUser(input),
    ]);

    const created = results.filter((result) => result !== null);
    assert.equal(created.length, 1);
    tenantId = created[0]?.tenantId;
    assert.ok(tenantId);

    const memberships = await prisma.tenantMembership.findMany({
      where: { userId },
      select: { tenantId: true, role: true },
    });
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0]?.tenantId, tenantId);
    assert.equal(memberships[0]?.role, "OWNER");

    const accounts = await prisma.ledgerAccount.count({ where: { tenantId } });
    assert.ok(accounts > 0);
  } finally {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
