import { redirect } from "next/navigation";
import { getSession } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { AuthForm } from "@/components/auth-form";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) redirect("/login");

  const ownerAccount = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (ownerAccount) redirect("/login");

  const locale = await currentLocale();
  return <AuthForm mode="register" locale={locale} />;
}
