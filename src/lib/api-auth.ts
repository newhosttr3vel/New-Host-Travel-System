import { getTenantContext, TenantAccessError } from "@/lib/tenant-context";
import { setTenantRlsContext } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions";

export async function requireTenantPermission(request: Request, permission: Permission) {
  try {
    const { session, membership } = await getTenantContext(request.headers);
    if (!session) {
      return { ok: false as const, response: Response.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
    }
    if (!membership) {
      return { ok: false as const, response: Response.json({ error: "TENANT_SETUP_REQUIRED" }, { status: 409 }) };
    }
    if (!hasPermission(membership.role, permission)) {
      return { ok: false as const, response: Response.json({ error: "FORBIDDEN" }, { status: 403 }) };
    }
    return { ok: true as const, session, membership };
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return { ok: false as const, response: Response.json({ error: "FORBIDDEN" }, { status: 403 }) };
    }
    throw error;
  }
}


/**
 * Call in the route-handler's own async context immediately after authorization.
 * AsyncLocalStorage.enterWith inside a nested authorization helper does not
 * propagate to a caller's already-created continuation.
 */
export function activateTenantRequestContext(access: {
  session: { user: { id: string } };
  membership: { tenantId: string };
}) {
  setTenantRlsContext({
    userId: access.session.user.id,
    tenantId: access.membership.tenantId
  });
}
