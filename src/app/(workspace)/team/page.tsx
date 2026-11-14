import { redirect } from "next/navigation";
import { currentLocale } from "@/lib/i18n";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma, setTenantRlsContext } from "@/lib/prisma";
import { TeamManagement } from "@/components/team-management";

export default async function TeamPage() {
  const { session, membership } = await getTenantContext();
  if (!session) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (membership.role !== "OWNER" || !session.user.emailVerified ||
      session.user.email.toLowerCase() !== process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase()) redirect("/dashboard");
  setTenantRlsContext({ userId: session.user.id, tenantId: membership.tenantId });
  const members = await prisma.tenantMembership.findMany({
    where: { tenantId: membership.tenantId },
    include: { user: { select: { id: true, name: true, email: true, emailVerified: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return <TeamManagement locale={await currentLocale()} initialMembers={members.map(({ id, role, createdAt, user }) => ({
    id, role, createdAt: createdAt.toISOString(), user,
  }))} />;
}
