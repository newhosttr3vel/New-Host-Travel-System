# Testing and quality checks

## Automated commands

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.

CI runs PostgreSQL 16, applies migrations as the migration/admin account, provisions a separate non-owner `ci_runtime` login that inherits `new_host_app`, and uses it via `APP_DATABASE_URL` for application and integration tests.

## Automated coverage

- Role grants, inherited JavaScript property names, read-only restrictions and unknown-role denial.
- Full customer/supplier/hotel directory pagination.
- Branch access rules (owners/admins, assigned employees and unassigned employees).
- Reservation status transitions, date and hotel-price calculations.
- PostgreSQL foreign-key tenant consistency and concurrent workspace onboarding.
- RLS cross-tenant read/write denial with a non-owner runtime connection.
- Authenticated customer API cross-tenant list, update and archive denial.
- Private-document MIME signature and filename validation.
- Finance journal balancing, invoice/payment calculations, hotel reservation persistence and reservation relationship tenant isolation.

## Provider- and browser-dependent verification

- Configure a real Resend sender and verify registration email, verification link, expired token, password reset and session revocation.
- Configure a private S3 bucket and verify upload, signed download expiry, access denial, retention and deletion.
- Configure GitHub Actions OIDC to the private backup bucket, execute the scheduled backup, then perform a restore drill against an isolated database.
- Browser E2E for invitations, every role/permission pair, branch administration, Arabic RTL, English LTR, keyboard accessibility and responsive layouts.
- Review all finance report/export endpoints for cross-tenant and branch access.

CI passing proves only the automated checks in that run. It does not prove provider credentials, mail delivery, object storage, scheduled cloud backups, restore success or a browser workflow unless those checks actually run.
