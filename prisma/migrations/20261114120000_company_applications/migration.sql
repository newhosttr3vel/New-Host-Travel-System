CREATE TYPE "CompanyApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE "platform_company_applications" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "companyName" TEXT NOT NULL, "legalName" TEXT,
 "country" TEXT NOT NULL, "city" TEXT NOT NULL, "phone" TEXT NOT NULL,
 "defaultCurrency" TEXT NOT NULL DEFAULT 'EGP', "defaultLanguage" TEXT NOT NULL DEFAULT 'ar',
 "status" "CompanyApplicationStatus" NOT NULL DEFAULT 'PENDING', "rejectionReason" TEXT,
 "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "platform_company_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_company_applications_userId_key" ON "platform_company_applications"("userId");
CREATE INDEX "platform_company_applications_status_createdAt_idx" ON "platform_company_applications"("status", "createdAt");
ALTER TABLE "platform_company_applications" ADD CONSTRAINT "platform_company_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
