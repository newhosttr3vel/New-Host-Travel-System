import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const { session, membership } = await getTenantContext();
  if (!session) redirect("/login");
  if (membership) redirect("/dashboard");
  const locale = await currentLocale();
  return <OnboardingForm locale={locale} userName={session.user.name ?? session.user.email ?? "User"} />;
}
