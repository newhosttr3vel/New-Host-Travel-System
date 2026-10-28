import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

test("PostgreSQL accepts balanced journal entries and rejects unbalanced or cross-tenant lines", { skip: process.env.RUN_DB_TESTS !== "true" }, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the finance ledger integration test.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 14).toLowerCase();
  let firstTenantId: string | undefined;
  let secondTenantId: string | undefined;

  try {
    const firstTenant = await prisma.tenant.create({
      data: { name: "Finance Integration A", slug: `finance-a-${suffix}` }
    });
    firstTenantId = firstTenant.id;
    const secondTenant = await prisma.tenant.create({
      data: { name: "Finance Integration B", slug: `finance-b-${suffix}` }
    });
    secondTenantId = secondTenant.id;

    const cash = await prisma.ledgerAccount.create({
      data: { tenantId: firstTenant.id, code: `CASH-${suffix}`, name: "نقدية اختبار", nameEn: "Test cash", type: "ASSET" }
    });
    const revenue = await prisma.ledgerAccount.create({
      data: { tenantId: firstTenant.id, code: `REV-${suffix}`, name: "إيراد اختبار", nameEn: "Test revenue", type: "REVENUE" }
    });
    const foreignCash = await prisma.ledgerAccount.create({
      data: { tenantId: secondTenant.id, code: `CASH-B-${suffix}`, name: "نقدية شركة أخرى", nameEn: "Other tenant cash", type: "ASSET" }
    });

    const goodEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: firstTenant.id,
          reference: `GOOD-${suffix}`,
          entryDate: new Date("2026-10-28T12:00:00.000Z"),
          description: "Balanced journal integration test",
          currency: "EGP",
          exchangeRate: "1.00000000",
          sourceType: "MANUAL"
        }
      });
      await tx.journalLine.createMany({
        data: [
          { tenantId: firstTenant.id, journalEntryId: entry.id, accountId: cash.id, debit: "100.00", credit: "0", baseDebit: "100.00", baseCredit: "0" },
          { tenantId: firstTenant.id, journalEntryId: entry.id, accountId: revenue.id, debit: "0", credit: "100.00", baseDebit: "0", baseCredit: "100.00" }
        ]
      });
      return entry;
    });
    assert.equal(goodEntry.tenantId, firstTenant.id);

    await assert.rejects(prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: firstTenant.id,
          reference: `BAD-${suffix}`,
          entryDate: new Date("2026-10-28T12:00:00.000Z"),
          description: "Intentionally unbalanced journal",
          currency: "EGP",
          exchangeRate: "1.00000000",
          sourceType: "MANUAL"
        }
      });
      await tx.journalLine.createMany({
        data: [
          { tenantId: firstTenant.id, journalEntryId: entry.id, accountId: cash.id, debit: "100.00", credit: "0", baseDebit: "100.00", baseCredit: "0" },
          { tenantId: firstTenant.id, journalEntryId: entry.id, accountId: revenue.id, debit: "0", credit: "99.00", baseDebit: "0", baseCredit: "99.00" }
        ]
      });
    }));

    await assert.rejects(prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: firstTenant.id,
          reference: `CROSS-${suffix}`,
          entryDate: new Date("2026-10-28T12:00:00.000Z"),
          description: "Intentionally cross-tenant journal",
          currency: "EGP",
          exchangeRate: "1.00000000",
          sourceType: "MANUAL"
        }
      });
      await tx.journalLine.createMany({
        data: [
          { tenantId: firstTenant.id, journalEntryId: entry.id, accountId: cash.id, debit: "100.00", credit: "0", baseDebit: "100.00", baseCredit: "0" },
          { tenantId: firstTenant.id, journalEntryId: entry.id, accountId: foreignCash.id, debit: "0", credit: "100.00", baseDebit: "0", baseCredit: "100.00" }
        ]
      });
    }));
  } finally {
    if (firstTenantId) await prisma.tenant.delete({ where: { id: firstTenantId } });
    if (secondTenantId) await prisma.tenant.delete({ where: { id: secondTenantId } });
    await prisma.$disconnect();
  }
});
