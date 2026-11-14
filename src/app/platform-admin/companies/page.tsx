import { redirect } from "next/navigation";
import { getSession } from "@/lib/tenant-context";
import { CompanyApplicationsAdmin } from "@/components/company-applications-admin";

export default async function PlatformCompaniesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  const isVerifiedOwner =
    Boolean(session.user.emailVerified) &&
    Boolean(ownerEmail) &&
    session.user.email.toLowerCase() === ownerEmail;

  if (!isVerifiedOwner) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold">غير مصرح بالدخول</h1>
          <p className="mt-3 text-slate-600">
            هذه الصفحة مخصصة لبريد مالك المنصة الموثّق والمحدد في إعداد SYSTEM_OWNER_EMAIL.
          </p>
        </section>
      </main>
    );
  }

  return <CompanyApplicationsAdmin />;
}
