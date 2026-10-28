import test from "node:test";
import assert from "node:assert/strict";
import { activeRowsForTenant } from "../src/lib/tenant-data";

test("records are scoped to their workspace and archived records are excluded", () => {
  const rows = [
    { id: "a", tenantId: "tenant-a", archivedAt: "" },
    { id: "b", tenantId: "tenant-b", archivedAt: "" },
    { id: "c", tenantId: "tenant-a", archivedAt: "2026-01-01T00:00:00.000Z" }
  ];
  assert.deepEqual(activeRowsForTenant(rows, "tenant-a").map((row) => row.id), ["a"]);
  assert.deepEqual(activeRowsForTenant(rows, "tenant-b").map((row) => row.id), ["b"]);
  assert.deepEqual(activeRowsForTenant(rows, "tenant-c"), []);
});
