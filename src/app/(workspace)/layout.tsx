import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { session, membership } = await getTenantContext();
  if (!session) redirect("/login");
  if (!membership) redirect("/onboarding");
  const locale = await currentLocale();
  return <WorkspaceShell locale={locale} tenantName={membership.tenant.name} role={membership.role} userName={session.user.name}>{children}</WorkspaceShell>;
}
