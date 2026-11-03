import type { TenantRole } from "@/lib/permissions";
type BranchAssignment = { branchId: string };
type BranchMembershipContext = { role: TenantRole | string; branchAssignments?: BranchAssignment[] };

export function branchScopeWhere(membership: BranchMembershipContext): { branchId?: { in: string[] } } {
  if (membership.role === "OWNER" || membership.role === "ADMINISTRATOR") return {};
  const ids = [...new Set((membership.branchAssignments ?? []).map((item) => item.branchId))];
  return { branchId: { in: ids } };
}
export function canAccessBranch(membership: BranchMembershipContext, branchId: string | null | undefined): boolean {
  if (membership.role === "OWNER" || membership.role === "ADMINISTRATOR") return true;
  return Boolean(branchId && (membership.branchAssignments ?? []).some((item) => item.branchId === branchId));
}

export async function resolveBranchForMember(
  membership: BranchMembershipContext,
  requestedBranchId: string | undefined,
  lookup: (branchId: string | undefined) => Promise<{ id: string } | null>
): Promise<{ ok: true; branchId: string } | { ok: false; error: "BRANCH_NOT_FOUND" | "BRANCH_NOT_ASSIGNED" }> {
  const isAdministrator = membership.role === "OWNER" || membership.role === "ADMINISTRATOR";
  const assigned = [...new Set((membership.branchAssignments ?? []).map((item) => item.branchId))];
  const candidate = requestedBranchId ?? (isAdministrator ? undefined : assigned[0]);
  const branch = await lookup(candidate);
  if (!branch) return { ok: false, error: "BRANCH_NOT_FOUND" };
  if (!canAccessBranch(membership, branch.id)) return { ok: false, error: "BRANCH_NOT_ASSIGNED" };
  return { ok: true, branchId: branch.id };
}
