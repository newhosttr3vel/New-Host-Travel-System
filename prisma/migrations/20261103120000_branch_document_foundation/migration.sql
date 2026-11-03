ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_id_tenantId_key" UNIQUE ("id", "tenantId");
ALTER TABLE "branches" ADD CONSTRAINT "branches_id_tenantId_key" UNIQUE ("id", "tenantId");
ALTER TABLE "reservations" ADD COLUMN "branchId" TEXT;

INSERT INTO "branches" ("id", "tenantId", "name", "slug", "isActive", "createdAt", "updatedAt")
SELECT 'main-' || t."id", t."id", 'Main Branch', 'main', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (SELECT 1 FROM "branches" b WHERE b."tenantId" = t."id" AND b."slug" = 'main');

UPDATE "reservations" r
SET "branchId" = b."id"
FROM "branches" b
WHERE b."tenantId" = r."tenantId" AND b."slug" = 'main' AND r."branchId" IS NULL;

CREATE TABLE "branch_memberships" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branch_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "branch_memberships_branchId_tenantId_fkey" FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "branch_memberships_membershipId_tenantId_fkey" FOREIGN KEY ("membershipId", "tenantId") REFERENCES "tenant_memberships"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "branch_memberships_branchId_membershipId_key" ON "branch_memberships"("branchId", "membershipId");
CREATE UNIQUE INDEX "branch_memberships_id_tenantId_key" ON "branch_memberships"("id", "tenantId");
CREATE INDEX "branch_memberships_tenantId_membershipId_idx" ON "branch_memberships"("tenantId", "membershipId");

INSERT INTO "branch_memberships" ("id", "tenantId", "branchId", "membershipId", "createdAt")
SELECT 'bm-' || m."id", m."tenantId", b."id", m."id", CURRENT_TIMESTAMP
FROM "tenant_memberships" m
JOIN "branches" b ON b."tenantId" = m."tenantId" AND b."slug" = 'main'
ON CONFLICT ("branchId", "membershipId") DO NOTHING;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_branchId_tenantId_fkey"
  FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "reservations_tenantId_branchId_status_startDate_idx"
  ON "reservations"("tenantId", "branchId", "status", "startDate");

CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "reservationId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_objectKey_key" UNIQUE ("objectKey"),
  CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "documents_branchId_tenantId_fkey" FOREIGN KEY ("branchId", "tenantId") REFERENCES "branches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "documents_reservationId_tenantId_fkey" FOREIGN KEY ("reservationId", "tenantId") REFERENCES "reservations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "documents_id_tenantId_key" ON "documents"("id", "tenantId");
CREATE INDEX "documents_tenantId_reservationId_createdAt_idx" ON "documents"("tenantId", "reservationId", "createdAt");
CREATE INDEX "documents_tenantId_branchId_createdAt_idx" ON "documents"("tenantId", "branchId", "createdAt");
