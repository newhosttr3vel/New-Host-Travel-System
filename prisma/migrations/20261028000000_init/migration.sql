CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'BRANCH_MANAGER', 'RESERVATIONS_MANAGER', 'RESERVATIONS_AGENT', 'ACCOUNTANT', 'SALES', 'VISA_OFFICER', 'OPERATIONS', 'HR_MANAGER', 'AUDITOR', 'READ_ONLY');
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'CORPORATE');
CREATE TYPE "SupplierCategory" AS ENUM ('HOTEL', 'AIRLINE', 'TRANSPORT', 'VISA_PROVIDER', 'TOUR_OPERATOR', 'OTHER');
CREATE TYPE "ReservationServiceType" AS ENUM ('HOTEL', 'FLIGHT', 'VISA', 'TRANSPORT', 'UMRAH_PACKAGE', 'HAJJ_PACKAGE', 'TOUR', 'OTHER');
CREATE TYPE "ReservationStatus" AS ENUM ('INQUIRY', 'QUOTATION', 'PENDING', 'ON_HOLD', 'CONFIRMED', 'PARTIALLY_PAID', 'FULLY_PAID', 'COMPLETED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "user" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false, "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE TABLE "session" (
  "id" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "account" (
  "id" TEXT NOT NULL, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "issuer" TEXT, "accessToken" TEXT, "refreshToken" TEXT,
  "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMP(3), "refreshTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT, "password" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "account_userId_idx" ON "account"("userId");
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "verification" (
  "id" TEXT NOT NULL, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

CREATE TABLE "tenants" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL', "defaultLanguage" TEXT NOT NULL DEFAULT 'ar',
  "defaultCurrency" TEXT NOT NULL DEFAULT 'EGP', "timeZone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_status_createdAt_idx" ON "tenants"("status", "createdAt");

CREATE TABLE "tenant_memberships" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL DEFAULT 'READ_ONLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");
CREATE INDEX "tenant_memberships_userId_createdAt_idx" ON "tenant_memberships"("userId", "createdAt");
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "branches" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_tenantId_slug_key" ON "branches"("tenantId", "slug");
CREATE INDEX "branches_tenantId_isActive_idx" ON "branches"("tenantId", "isActive");
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customers" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
  "name" TEXT NOT NULL, "companyName" TEXT, "email" TEXT, "phone" TEXT, "nationality" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_id_tenantId_key" ON "customers"("id", "tenantId");
CREATE INDEX "customers_tenantId_archivedAt_name_idx" ON "customers"("tenantId", "archivedAt", "name");
CREATE INDEX "customers_tenantId_email_idx" ON "customers"("tenantId", "email");
CREATE INDEX "customers_tenantId_phone_idx" ON "customers"("tenantId", "phone");
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "suppliers" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "category" "SupplierCategory" NOT NULL DEFAULT 'OTHER', "contactName" TEXT, "email" TEXT, "phone" TEXT,
  "paymentTerms" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "archivedAt" TIMESTAMP(3),
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "suppliers_id_tenantId_key" ON "suppliers"("id", "tenantId");
CREATE INDEX "suppliers_tenantId_archivedAt_name_idx" ON "suppliers"("tenantId", "archivedAt", "name");
CREATE INDEX "suppliers_tenantId_category_idx" ON "suppliers"("tenantId", "category");
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "reservations" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "supplierId" TEXT,
  "reference" TEXT NOT NULL, "serviceType" "ReservationServiceType" NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'INQUIRY', "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'EGP', "saleAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "costAmount" DECIMAL(14,2) NOT NULL DEFAULT 0, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservations_tenantId_reference_key" ON "reservations"("tenantId", "reference");
CREATE INDEX "reservations_tenantId_status_startDate_idx" ON "reservations"("tenantId", "status", "startDate");
CREATE INDEX "reservations_tenantId_customerId_idx" ON "reservations"("tenantId", "customerId");
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customerId_tenantId_fkey" FOREIGN KEY ("customerId", "tenantId") REFERENCES "customers"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_supplierId_tenantId_fkey" FOREIGN KEY ("supplierId", "tenantId") REFERENCES "suppliers"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "audit_events" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "metadata" JSONB, "ipAddress" TEXT, "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_events_tenantId_createdAt_idx" ON "audit_events"("tenantId", "createdAt");
CREATE INDEX "audit_events_tenantId_entityType_entityId_idx" ON "audit_events"("tenantId", "entityType", "entityId");
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
