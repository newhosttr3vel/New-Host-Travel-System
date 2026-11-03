# Security posture and production requirements

## Controls implemented in this branch

- Better Auth manages password storage and sessions. Production requires verified email addresses, sends verification and reset links through the configured Resend account, expires both links after one hour, and revokes existing sessions after a password reset.
- Production authentication rate limits use shared PostgreSQL storage: five email sign-in attempts per minute and three sign-up attempts per hour.
- Tenant-owned PostgreSQL tables have row-level security enabled. The application runtime uses a non-owner `new_host_app` role with `NOBYPASSRLS`; request context is applied through transaction-local `app.user_id` and `app.tenant_id` settings. Policies deny tenant rows when context is missing or mismatched.
- The runtime Prisma client requires a separate `APP_DATABASE_URL` in production. `DATABASE_URL` remains the migration/admin connection and must not be exposed to the application process.
- Tenant membership rows are visible only to the authenticated user or within the currently selected tenant. Other tenant-owned rows require both a selected tenant and a membership for the current user.
- PostgreSQL permits the runtime role to create only the current user's initial membership in the selected tenant. Membership UPDATE/DELETE are revoked from the runtime role until a separate invitation/role-management workflow exists.
- Audit events are append-only for normal application traffic: the `new_host_app` role has no UPDATE or DELETE privileges on `audit_events`. Privileged migration/admin credentials can still perform maintenance and must be tightly restricted and audited.
- Branch assignments are stored independently from company membership. Owners and administrators see all branches; other employees see reservations, travel documents and branch-scoped financial records only for explicitly assigned branches. Unassigned employees see no branch-specific records.
- Reservations carry a branch reference protected by a composite tenant foreign key. Existing tenants and memberships are backfilled into a Main Branch.
- Passport and travel attachments use a private S3-compatible bucket, random object keys, MIME signature checks, a 15 MB ceiling, SHA-256 metadata, and 60-second signed download URLs.
- The document API checks company, branch and explicit `documents:read` / `documents:write` permissions on list, upload and download operations and writes an audit event on upload. Read-only, sales, accounting and auditor roles do not automatically receive passport-document access.
- Workspace onboarding creates an owner, Main Branch, branch assignment and default ledger accounts in a serialized transaction.
- CI is configured to migrate as an admin and run RLS integration tests using a separate non-owner login.
- A scheduled GitHub Actions workflow creates encrypted PostgreSQL dumps and uploads them to a private S3 bucket; a 35-day lifecycle policy template is included. Existing local backup/restore scripts remain available.

## External setup required before enabling production

### PostgreSQL roles

1. Apply migrations using `DATABASE_URL`.
2. Create a separate PostgreSQL login for the web service, for example:

   ```sql
   CREATE ROLE new_host_runtime LOGIN PASSWORD 'use-a-long-random-secret'
     NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT;
   GRANT new_host_app TO new_host_runtime;
   ```

3. Set `APP_DATABASE_URL` to that login. The login must not own tables, be a superuser, or have `BYPASSRLS`.
4. Do not set `APP_DATABASE_URL` equal to the migration/admin connection string.

### Email

- Configure a Resend API key and a verified sender domain/address.
- Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in the production secret manager.
- Test a real registration, verification-link click, expired token, reset link, and post-reset session revocation before enabling real users.

### Private document bucket

- Configure `S3_BUCKET`, `S3_REGION`, and either workload identity or `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Set `S3_ENDPOINT` only for an S3-compatible provider with a custom endpoint.
- Block public access, disable public ACLs, enable encryption at rest and apply a retention/lifecycle policy appropriate for travel identity documents.
- Grant only the application identity the necessary object read/write/delete permissions. Do not place document links in public pages or logs.

### Backups

- Configure GitHub Actions repository variables `AWS_BACKUP_ROLE_ARN`, `AWS_BACKUP_BUCKET`, `AWS_BACKUP_REGION`, and secret `BACKUP_DATABASE_URL`.
- Set up AWS OIDC trust for this repository and the backup workflow. The backup database credential should be read-only and permitted to run `pg_dump`.
- Apply `infra/backup-lifecycle.json` to the target bucket and verify encryption, access logging and retention.
- Run and document a restore drill. A successful upload alone is not proof that a backup can be restored.

## Remaining security work

- Broader authenticated API integration coverage for every financial mutation and tenant-scoped read/update/archive workflow. The repository does not currently expose a data-export API; every future export endpoint must apply the same tenant and branch filters and receive cross-company denial tests.
- A browser E2E suite for registration, email delivery, invitations, tenant switching, branch access, responsive Arabic RTL/English LTR, and keyboard accessibility.
- A complete invitation lifecycle, explicit exceptional support-access controls, and review of every role/permission combination.
- Extend integration tests across all finance endpoint mutations and any future exports. Existing journal, invoice, supplier-bill, payment, trial-balance and dashboard queries are branch-scoped.
- Operational observability, alerting, secret scanning, incident response, data-retention policy, restore drills and a third-party security assessment.
- Validate CSP, HTTPS, trusted origins, host permissions, rate limits and database grants in the chosen production provider.

No certification, legal/tax compliance or independent penetration test is claimed. Keep all real passport, identity and payment documents out of the system until provider configuration and independent security review are complete.
