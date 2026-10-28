import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../src/lib/permissions";

test("owner can manage customer records", () => {
  assert.equal(hasPermission("OWNER", "customers:read"), true);
  assert.equal(hasPermission("OWNER", "customers:write"), true);
  assert.equal(hasPermission("OWNER", "customers:archive"), true);
});
test("read-only users cannot mutate business records", () => {
  assert.equal(hasPermission("READ_ONLY", "customers:read"), true);
  assert.equal(hasPermission("READ_ONLY", "customers:write"), false);
  assert.equal(hasPermission("READ_ONLY", "customers:archive"), false);
  assert.equal(hasPermission("READ_ONLY", "finance:approve"), false);
});
test("finance role cannot administer company settings", () => {
  assert.equal(hasPermission("ACCOUNTANT", "finance:read"), true);
  assert.equal(hasPermission("ACCOUNTANT", "finance:approve"), true);
  assert.equal(hasPermission("ACCOUNTANT", "settings:manage"), false);
  assert.equal(hasPermission("ACCOUNTANT", "users:manage"), false);
});
test("unknown roles fail closed", () => {
  assert.equal(hasPermission("PLATFORM_ADMIN", "customers:read"), false);
});
