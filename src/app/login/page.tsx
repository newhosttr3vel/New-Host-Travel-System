import { redirect } from "next/navigation";
import { getSession } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const locale = await currentLocale();
  return <AuthForm mode="login" locale={locale} />;
}
