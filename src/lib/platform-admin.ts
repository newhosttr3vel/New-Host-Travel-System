import { auth } from "@/lib/auth";
import { setTenantRlsContext } from "@/lib/prisma";

export async function requirePlatformAdmin(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  if (!session.user.emailVerified || !ownerEmail || session.user.email.toLowerCase() !== ownerEmail) return null;
  setTenantRlsContext({ userId: session.user.id });
  return session;
}
