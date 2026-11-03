ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "branches" ADD CONSTRAINT "branches_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "reservations" ADD COLUMN "branch_id" TEXT;

INSERT INTO "branches" ("id", "tenant_id", "name", "slug", "is_active", "created_at", "updated_at")
SELECT 'main-' || t."id", t."id", 'Main Branch', 'main', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (SELECT 1 FROM "branches" b WHERE b."tenant_id" = t."id" AND b."slug" = 'main');

UPDATE "reservations" r
SET "branch_id" = b."id"
FROM "branches" b
WHERE b."tenant_id" = r."tenant_id" AND b."slug" = 'main' AND r."branch_id" IS NULL;

CREATE TABLE "branch_memberships" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branch_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "branch_memberships_branch_tenant_fkey" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "branch_memberships_membership_tenant_fkey" FOREIGN KEY ("membership_id", "tenant_id") REFERENCES "tenant_memberships"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "branch_memberships_branch_id_membership_id_key" ON "branch_memberships"("branch_id", "membership_id");
CREATE UNIQUE INDEX "branch_memberships_id_tenant_id_key" ON "branch_memberships"("id", "tenant_id");
CREATE INDEX "branch_memberships_tenant_id_membership_id_idx" ON "branch_memberships"("tenant_id", "membership_id");

INSERT INTO "branch_memberships" ("id", "tenant_id", "branch_id", "membership_id", "created_at")
SELECT 'bm-' || m."id", m."tenant_id", b."id", m."id", CURRENT_TIMESTAMP
FROM "tenant_memberships" m
JOIN "branches" b ON b."tenant_id" = m."tenant_id" AND b."slug" = 'main'
ON CONFLICT ("branch_id", "membership_id") DO NOTHING;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_branch_id_tenant_id_fkey"
  FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "reservations_tenant_id_branch_id_status_start_date_idx"
  ON "reservations"("tenant_id", "branch_id", "status", "start_date");

CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "reservation_id" TEXT,
  "uploaded_by_id" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_object_key_key" UNIQUE ("object_key"),
  CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "documents_branch_tenant_fkey" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "documents_reservation_tenant_fkey" FOREIGN KEY ("reservation_id", "tenant_id") REFERENCES "reservations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "documents_id_tenant_id_key" ON "documents"("id", "tenant_id");
CREATE INDEX "documents_tenant_id_reservation_id_created_at_idx" ON "documents"("tenant_id", "reservation_id", "created_at");
CREATE INDEX "documents_tenant_id_branch_id_created_at_idx" ON "documents"("tenant_id", "branch_id", "created_at");
