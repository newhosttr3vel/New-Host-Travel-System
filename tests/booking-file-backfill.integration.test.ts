import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "pg";

const bookingFileMigration = "20261117100000_booking_file_foundation";

test("booking-file migration backfills populated legacy reservations without changing financial links", {
  skip: process.env.RUN_MIGRATION_BACKFILL_TESTS !== "true"
}, async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the populated legacy migration test.");

  const sourceUrl = new URL(connectionString);
  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  assert.ok(
    allowedHosts.has(sourceUrl.hostname),
    "The migration fixture may only create a temporary database on a loopback PostgreSQL host."
  );

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toLowerCase();
  const databaseName = "nht_booking_backfill_" + suffix;
  assert.match(databaseName, /^[a-z0-9_]+$/);

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const admin = new Client({ connectionString: adminUrl.toString() });
  let adminConnected = false;
  let databaseCreated = false;
  let legacy: Client | undefined;

  try {
    await admin.connect();
    adminConnected = true;

    const privilege = await admin.query<{ rolsuper: boolean }>(
      "SELECT rolsuper FROM pg_roles WHERE rolname = current_user"
    );
    assert.equal(
      privilege.rows[0]?.rolsuper,
      true,
      "The isolated migration fixture requires the CI database administrator to create and drop a temporary database."
    );

    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;

    const legacyUrl = new URL(connectionString);
    legacyUrl.pathname = "/" + databaseName;
    legacyUrl.searchParams.delete("schema");
    legacy = new Client({ connectionString: legacyUrl.toString() });
    await legacy.connect();

    const migrationRoot = resolve(process.cwd(), "prisma", "migrations");
    const migrationDirectories = readdirSync(migrationRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name < bookingFileMigration)
      .map((entry) => entry.name)
      .sort();

    assert.ok(migrationDirectories.length > 0, "Expected the legacy migrations before the booking-file migration.");
    assert.ok(
      readdirSync(migrationRoot).includes(bookingFileMigration),
      "The booking-file migration directory must exist."
    );

    // Build the exact pre-booking-file schema, then insert representative legacy rows.
    for (const directory of migrationDirectories) {
      const sql = readFileSync(join(migrationRoot, directory, "migration.sql"), "utf8");
      await legacy.query(sql);
    }

    const tenantId = "legacy-tenant-" + suffix;
    const branchId = "legacy-branch-" + suffix;
    const customerId = "legacy-customer-" + suffix;
    const supplierId = "legacy-supplier-" + suffix;
    const activeReservationId = "legacy-active-" + suffix;
    const archivedReservationId = "legacy-archived-" + suffix;
    const now = new Date("2026-10-01T10:00:00.000Z");
    const createdAt = new Date("2026-10-02T10:00:00.000Z");
    const updatedAt = new Date("2026-10-03T10:00:00.000Z");
    const archivedAt = new Date("2026-10-04T10:00:00.000Z");

    await legacy.query(
      'INSERT INTO "tenants" ("id", "name", "slug", "updatedAt") VALUES ($1, $2, $3, $4)',
      [tenantId, "Legacy Backfill Tenant", "legacy-backfill-" + suffix, now]
    );
    await legacy.query(
      'INSERT INTO "branches" ("id", "tenantId", "name", "slug", "updatedAt") VALUES ($1, $2, $3, $4, $5)',
      [branchId, tenantId, "Legacy Main Branch", "legacy-main-" + suffix, now]
    );
    await legacy.query(
      'INSERT INTO "customers" ("id", "tenantId", "type", "name", "updatedAt") VALUES ($1, $2, \'CORPORATE\', $3, $4)',
      [customerId, tenantId, "Legacy B2B Customer", now]
    );
    await legacy.query(
      'INSERT INTO "suppliers" ("id", "tenantId", "name", "updatedAt") VALUES ($1, $2, $3, $4)',
      [supplierId, tenantId, "Legacy Hotel Supplier", now]
    );

    await legacy.query(
      `INSERT INTO "reservations" (
        "id", "tenantId", "branchId", "customerId", "supplierId", "supplierTenantId",
        "reference", "serviceType", "status", "startDate", "endDate", "currency",
        "saleAmount", "costAmount", "notes", "createdAt", "updatedAt", "archivedAt"
      ) VALUES
        ($1, $2, $3, $4, $5, $2, $6, 'HOTEL', 'CONFIRMED', $7, $8, 'SAR', 5200, 4100, $9, $10, $11, NULL),
        ($12, $2, NULL, $4, NULL, NULL, $13, 'VISA', 'CANCELLED', NULL, NULL, 'EGP', 900, 650, $14, $10, $11, $15)`,
      [
        activeReservationId,
        tenantId,
        branchId,
        customerId,
        supplierId,
        "LEGACY-HOTEL-" + suffix,
        new Date("2026-12-10T00:00:00.000Z"),
        new Date("2026-12-14T00:00:00.000Z"),
        "Legacy active reservation",
        createdAt,
        updatedAt,
        archivedReservationId,
        "LEGACY-VISA-" + suffix,
        "Legacy archived reservation",
        archivedAt
      ]
    );

    const invoiceJournalId = "legacy-invoice-je-" + suffix;
    const supplierJournalId = "legacy-supplier-je-" + suffix;
    await legacy.query(
      `INSERT INTO "journal_entries" ("id", "tenantId", "branchId", "reference", "entryDate", "description")
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $3, $8, $5, $9)`,
      [
        invoiceJournalId,
        tenantId,
        branchId,
        "LEGACY-JE-AR-" + suffix,
        now,
        "Legacy customer invoice journal",
        supplierJournalId,
        "LEGACY-JE-AP-" + suffix,
        "Legacy supplier bill journal"
      ]
    );
    const invoiceId = "legacy-invoice-" + suffix;
    const supplierBillId = "legacy-supplier-bill-" + suffix;
    await legacy.query(
      `INSERT INTO "invoices" (
        "id", "tenantId", "branchId", "customerId", "reservationId", "journalEntryId",
        "reference", "issueDate", "subtotal", "total", "idempotencyKey", "requestHash", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 5200, 5200, $9, $10, $11)`,
      [
        invoiceId,
        tenantId,
        branchId,
        customerId,
        activeReservationId,
        invoiceJournalId,
        "LEGACY-INV-" + suffix,
        now,
        "legacy-invoice-key-" + suffix,
        "legacy-invoice-hash-" + suffix,
        updatedAt
      ]
    );
    await legacy.query(
      `INSERT INTO "supplier_bills" (
        "id", "tenantId", "branchId", "supplierId", "reservationId", "journalEntryId",
        "reference", "billDate", "subtotal", "total", "idempotencyKey", "requestHash", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 4100, 4100, $9, $10, $11)`,
      [
        supplierBillId,
        tenantId,
        branchId,
        supplierId,
        activeReservationId,
        supplierJournalId,
        "LEGACY-SB-" + suffix,
        now,
        "legacy-supplier-key-" + suffix,
        "legacy-supplier-hash-" + suffix,
        updatedAt
      ]
    );

    const reservationSnapshotSql = `SELECT
      "id", "tenantId", "branchId", "customerId", "supplierId", "supplierTenantId",
      "reference", "serviceType", "status", "startDate", "endDate", "currency",
      "saleAmount"::text AS "saleAmount", "costAmount"::text AS "costAmount",
      "notes", "createdAt", "updatedAt", "archivedAt"
      FROM "reservations" WHERE "tenantId" = $1 ORDER BY "id"`;
    const invoiceSnapshotSql = `SELECT "id", "reservationId", "journalEntryId", "reference", "total"::text AS "total"
      FROM "invoices" WHERE "tenantId" = $1 ORDER BY "id"`;
    const supplierBillSnapshotSql = `SELECT "id", "reservationId", "journalEntryId", "reference", "total"::text AS "total"
      FROM "supplier_bills" WHERE "tenantId" = $1 ORDER BY "id"`;

    const reservationsBefore = await legacy.query(reservationSnapshotSql, [tenantId]);
    const invoicesBefore = await legacy.query(invoiceSnapshotSql, [tenantId]);
    const supplierBillsBefore = await legacy.query(supplierBillSnapshotSql, [tenantId]);

    const bookingFileSql = readFileSync(
      join(migrationRoot, bookingFileMigration, "migration.sql"),
      "utf8"
    );
    await legacy.query(bookingFileSql);

    const reservationsAfter = await legacy.query(reservationSnapshotSql, [tenantId]);
    const invoicesAfter = await legacy.query(invoiceSnapshotSql, [tenantId]);
    const supplierBillsAfter = await legacy.query(supplierBillSnapshotSql, [tenantId]);

    assert.deepEqual(reservationsAfter.rows, reservationsBefore.rows, "Legacy reservation data must remain unchanged.");
    assert.deepEqual(invoicesAfter.rows, invoicesBefore.rows, "Existing invoice and journal links must remain unchanged.");
    assert.deepEqual(
      supplierBillsAfter.rows,
      supplierBillsBefore.rows,
      "Existing supplier bill and journal links must remain unchanged."
    );

    const backfilled = await legacy.query(
      `SELECT
        r."id" AS "reservationId",
        r."bookingFileId",
        r."customerId" AS "reservationCustomerId",
        r."branchId" AS "reservationBranchId",
        r."reference" AS "reservationReference",
        r."archivedAt" AS "reservationArchivedAt",
        bf."id" AS "fileId",
        bf."tenantId" AS "fileTenantId",
        bf."customerId" AS "fileCustomerId",
        bf."branchId" AS "fileBranchId",
        bf."reference" AS "fileReference",
        bf."archivedAt" AS "fileArchivedAt"
      FROM "reservations" r
      LEFT JOIN "booking_files" bf ON bf."id" = r."bookingFileId"
      WHERE r."tenantId" = $1
      ORDER BY r."id"`,
      [tenantId]
    );

    assert.equal(backfilled.rowCount, 2, "Every legacy reservation, including archived ones, must be retained.");
    for (const row of backfilled.rows) {
      assert.equal(row.bookingFileId, "bf_" + row.reservationId);
      assert.equal(row.fileId, "bf_" + row.reservationId);
      assert.equal(row.fileTenantId, tenantId);
      assert.equal(row.fileCustomerId, row.reservationCustomerId);
      assert.equal(row.fileBranchId, row.reservationBranchId);
      assert.equal(row.fileReference, row.reservationReference);
      assert.equal(
        row.fileArchivedAt?.getTime() ?? null,
        row.reservationArchivedAt?.getTime() ?? null,
        "The archived state must be carried to the corresponding booking file."
      );
    }

    const invoiceLink = await legacy.query(
      'SELECT "reservationId", "journalEntryId" FROM "invoices" WHERE "id" = $1',
      [invoiceId]
    );
    const supplierBillLink = await legacy.query(
      'SELECT "reservationId", "journalEntryId" FROM "supplier_bills" WHERE "id" = $1',
      [supplierBillId]
    );
    assert.equal(invoiceLink.rows[0]?.reservationId, activeReservationId);
    assert.equal(invoiceLink.rows[0]?.journalEntryId, invoiceJournalId);
    assert.equal(supplierBillLink.rows[0]?.reservationId, activeReservationId);
    assert.equal(supplierBillLink.rows[0]?.journalEntryId, supplierJournalId);
  } finally {
    try {
      if (legacy) await legacy.end();
    } finally {
      try {
        if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      } finally {
        if (adminConnected) await admin.end();
      }
    }
  }
});
