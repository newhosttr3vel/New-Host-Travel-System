import test from "node:test";
import assert from "node:assert/strict";
import { branchScopeWhere, canAccessBranch } from "../src/lib/branch-access";

test("owners and administrators can access all branches", () => {
  assert.deepEqual(branchScopeWhere({ role: "OWNER", branchAssignments: [] }), {});
  assert.deepEqual(branchScopeWhere({ role: "ADMINISTRATOR", branchAssignments: [] }), {});
});

test("branch members are limited to their assigned branches", () => {
  const membership = { role: "BRANCH_MANAGER", branchAssignments: [{ branchId: "branch-a" }] };
  assert.deepEqual(branchScopeWhere(membership), { branchId: { in: ["branch-a"] } });
  assert.equal(canAccessBranch(membership, "branch-a"), true);
  assert.equal(canAccessBranch(membership, "branch-b"), false);
});

test("unassigned employees are denied branch records", () => {
  const membership = { role: "RESERVATIONS_AGENT", branchAssignments: [] };
  assert.deepEqual(branchScopeWhere(membership), { branchId: { in: [] } });
  assert.equal(canAccessBranch(membership, "branch-a"), false);
});
