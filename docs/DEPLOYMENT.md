# Deployment guide

The application requires a Node.js web service and PostgreSQL. It cannot run as a static GitHub Pages site.

## 1. Database roles and migration

1. Create a PostgreSQL database and set `DATABASE_URL` to a migration/admin connection.
2. Run `npm ci`, `npm run db:generate` and `npm run db:migrate` from a trusted environment.
3. These migrations create the `new_host_app` NOLOGIN/NOBYPASSRLS role, enable tenant RLS and restrict UPDATE/DELETE on audit events for the runtime role.
4. Create a separate PostgreSQL LOGIN user and grant membership in the runtime role:

   ```sql
   CREATE ROLE new_host_runtime LOGIN PASSWORD 'use-a-generated-long-secret'
     NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT;
   GRANT new_host_app TO new_host_runtime;
   ```

5. Set `APP_DATABASE_URL` to the new runtime login. Keep `DATABASE_URL` for migrations only. The runtime login must never own tenant tables or have BYPASSRLS.
6. CI tests use the same two-connection pattern with a non-owner runtime role. Do not point production `APP_DATABASE_URL` to a database owner or superuser.

## 2. Email verification and password reset

Create a Resend account, verify your sender domain and set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in the host's secret manager. Production requires verified email. Verification and password-reset links expire after one hour; reset revokes existing sessions. Test real delivery and all token/error cases before inviting employees.

## 3. Private travel-document storage

Create an S3-compatible bucket with public access blocked and server-side encryption enabled. Configure `S3_BUCKET`, `S3_REGION` and either workload identity or storage access keys. Use `S3_ENDPOINT` only for an S3-compatible custom endpoint. The app validates PDF/JPEG/PNG signatures, rejects files above 15 MB, writes random object keys and returns 60-second signed download URLs. Configure an appropriate document retention and deletion process before storing passports or other identity documents.

## 4. Branch administration

Every existing company is migrated into a Main Branch, and current employees are assigned there to preserve visibility. Owners/administrators can create additional branches and assign tenant members in Settings. Reservation, document and existing finance APIs enforce branch membership. Journal entries, invoices, supplier bills, payments, trial balance and dashboard financial totals are filtered by assigned branch. There is no data-export API yet; any future export must apply the same branch filter.

## 5. Scheduled backups

Configure GitHub repository variables `AWS_BACKUP_ROLE_ARN`, `AWS_BACKUP_BUCKET`, `AWS_BACKUP_REGION` and secret `BACKUP_DATABASE_URL`. Configure AWS OIDC trust for the repository and backup workflow. Set the backup connection to read-only, apply `infra/backup-lifecycle.json` to the private bucket and verify encrypted uploads. Run an explicit `workflow_dispatch` backup and restore it to a separate test database. Do not treat upload success as a verified restore.

Local backup/restore commands are also available through `npm run local:backup` and `npm run local:restore`.

## 6. Runtime secrets

Set `DATABASE_URL`, `APP_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` and the S3 settings in the hosting provider. Never commit secret values. Set `SEED_DEMO_DATA=false`.

## Before commercial production use

- Complete authenticated API authorization coverage for all finance, report and export routes, plus an end-to-end browser suite.
- Test live email provider, private storage and scheduled backup/restore with the actual account configuration.
- Add the full invitation lifecycle, broaden finance API mutation tests, add tenant/branch-safe export endpoints only when required, and implement observability, alerting, incident response, secret scanning and retention controls.
- Obtain independent security and jurisdiction-specific legal/tax reviews.

No security certification, regulatory approval or independent penetration test is claimed.
