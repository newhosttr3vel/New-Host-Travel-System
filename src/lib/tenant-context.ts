import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listRows, type SheetRow } from "@/lib/sheets-store";
import type { TenantRole } from "@/lib/permissions";

export class TenantAccessError extends Error {
  constructor(message = "You do not have access to this company workspace.") {
    super(message);
    this.name = "TenantAccessError";
  }
}
export async function getSession() { return getServerSession(authOptions); }

export async function getTenantContext(requestHeaders?: Headers) {
  const currentHeaders = requestHeaders ?? await headers();
  const session = await getSession();
  if (!session?.user?.id) return { session: null, membership: null };
  const requestedTenantId = currentHeaders.get("x-tenant-id");
  const memberships = await listRows("Memberships");
  const membershipRow = memberships.find((row) => row.userId === session.user.id && (!requestedTenantId || row.tenantId === requestedTenantId));
  if (requestedTenantId && !membershipRow) throw new TenantAccessError();
  if (!membershipRow) return { session, membership: null };
  const tenants = await listRows("Tenants");
  const tenantRow = tenants.find((row) => row.id === membershipRow.tenantId);
  if (!tenantRow) return { session, membership: null };
  if (tenantRow.status === "SUSPENDED" || tenantRow.status === "CANCELLED") throw new TenantAccessError("This company workspace is currently unavailable.");
  const tenant: SheetRow = { ...tenantRow, status: tenantRow.status || "TRIAL" };
  return { session, membership: { ...membershipRow, role: (membershipRow.role || "READ_ONLY") as TenantRole, tenant } };
}
