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
