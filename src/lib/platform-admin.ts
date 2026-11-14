import { auth } from "@/lib/auth";
import { setTenantRlsContext } from "@/lib/prisma";

export async function requirePlatformAdmin(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const allowlist = new Set((process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!session.user.emailVerified || !allowlist.has(session.user.email.toLowerCase())) return null;
  setTenantRlsContext({ userId: session.user.id });
  return session;
}
