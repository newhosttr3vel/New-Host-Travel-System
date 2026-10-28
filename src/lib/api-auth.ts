import { getTenantContext, TenantAccessError } from "@/lib/tenant-context";
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
