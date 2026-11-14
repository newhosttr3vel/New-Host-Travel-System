import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-context";
import { currentLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { CompanyApplicationForm } from "@/components/onboarding-form";
export default async function OnboardingPage() {
 const {session,membership}=await getTenantContext();
 if(!session) redirect("/login");
 if(membership) redirect("/dashboard");
 const application=await prisma.platformCompanyApplication.findUnique({where:{userId:session.user.id},select:{status:true,companyName:true,rejectionReason:true,createdAt:true}});
 return <CompanyApplicationForm locale={await currentLocale()} userName={session.user.name} application={application?{...application,createdAt:application.createdAt.toISOString()}:null}/>;
}