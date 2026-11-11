import { currentLocale } from "@/lib/i18n";
import { ResetPasswordForm } from "@/components/reset-password-form";

type PageProps = { searchParams: Promise<{ token?: string; error?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const [params, locale] = await Promise.all([searchParams, currentLocale()]);
  const token = params.error ? undefined : params.token;
  return <ResetPasswordForm token={token} locale={locale} />;
}
