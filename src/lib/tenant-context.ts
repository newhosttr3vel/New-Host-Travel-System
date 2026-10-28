import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TenantRole } from "@/lib/permissions";

export class TenantAccessError extends Error {
  constructor(message = "You do not have access to this company workspace.") {
    super(message);
    this.name = "TenantAccessError";
  }
}
export async function getSession(requestHeaders?: Headers) {
  const currentHeaders = requestHeaders ?? (await headers());
  return auth.api.getSession({ headers: currentHeaders });
}
export async function getTenantContext(requestHeaders?: Headers) {
  const currentHeaders = requestHeaders ?? (await headers());
  const session = await auth.api.getSession({ headers: currentHeaders });
  if (!session) return { session: null, membership: null };
  const requestedTenantId = currentHeaders.get("x-tenant-id");
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: session.user.id, ...(requestedTenantId ? { tenantId: requestedTenantId } : {}) },
    include: { tenant: true },
    orderBy: { createdAt: "asc" }
  });
  if (requestedTenantId && !membership) throw new TenantAccessError();
  if (membership?.tenant.status === "SUSPENDED" || membership?.tenant.status === "CANCELLED") {
    throw new TenantAccessError("This company workspace is currently unavailable.");
  }
  return { session, membership: membership ? { ...membership, role: membership.role as TenantRole } : null };
}
