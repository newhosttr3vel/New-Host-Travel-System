import { currentLocale } from "@/lib/i18n";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { AuthBackdrop } from "@/components/auth-backdrop";

type PageProps = { searchParams: Promise<{ token?: string; error?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const [params, locale] = await Promise.all([searchParams, currentLocale()]);
  const token = params.error ? undefined : params.token;
  return <main className="auth-screen auth-screen-motion">
    <AuthBackdrop />
    <section className="auth-panel">
      <ResetPasswordForm token={token} locale={locale} />
    </section>
  </main>;
}
