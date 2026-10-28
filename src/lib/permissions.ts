export type TenantRole = "OWNER" | "ADMINISTRATOR" | "BRANCH_MANAGER" | "RESERVATIONS_MANAGER" | "RESERVATIONS_AGENT" | "ACCOUNTANT" | "SALES" | "VISA_OFFICER" | "OPERATIONS" | "HR_MANAGER" | "AUDITOR" | "READ_ONLY";
export type Permission = "customers:read" | "customers:write" | "customers:archive" | "suppliers:read" | "suppliers:write" | "reservations:read" | "reservations:write" | "finance:read" | "finance:approve" | "users:manage" | "settings:manage" | "reports:export";

const grants: Record<TenantRole, ReadonlySet<Permission>> = {
  OWNER: new Set(["customers:read","customers:write","customers:archive","suppliers:read","suppliers:write","reservations:read","reservations:write","finance:read","finance:approve","users:manage","settings:manage","reports:export"]),
  ADMINISTRATOR: new Set(["customers:read","customers:write","customers:archive","suppliers:read","suppliers:write","reservations:read","reservations:write","finance:read","finance:approve","users:manage","settings:manage","reports:export"]),
  BRANCH_MANAGER: new Set(["customers:read","customers:write","suppliers:read","suppliers:write","reservations:read","reservations:write","finance:read","reports:export"]),
  RESERVATIONS_MANAGER: new Set(["customers:read","customers:write","suppliers:read","reservations:read","reservations:write","finance:read","reports:export"]),
  RESERVATIONS_AGENT: new Set(["customers:read","customers:write","suppliers:read","reservations:read","reservations:write"]),
  ACCOUNTANT: new Set(["customers:read","suppliers:read","reservations:read","finance:read","finance:approve","reports:export"]),
  SALES: new Set(["customers:read","customers:write","suppliers:read","reservations:read","reservations:write"]),
  VISA_OFFICER: new Set(["customers:read","customers:write","reservations:read"]),
  OPERATIONS: new Set(["customers:read","suppliers:read","reservations:read","reservations:write"]),
  HR_MANAGER: new Set(["users:manage"]),
  AUDITOR: new Set(["customers:read","suppliers:read","reservations:read","finance:read","reports:export"]),
  READ_ONLY: new Set(["customers:read","suppliers:read","reservations:read"])
};
export function hasPermission(role: TenantRole | string, permission: Permission): boolean {
  if (!(role in grants)) return false;
  return grants[role as TenantRole].has(permission);
}
