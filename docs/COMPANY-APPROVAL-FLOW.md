# Company registration approval flow

Company registration is request-based. A user creates an authenticated account, then submits company details from `/onboarding`. Submitting creates a `PlatformCompanyApplication` in `PENDING`; it does not create a tenant or grant access to company operations.

Set `PLATFORM_ADMIN_EMAILS` to one or more comma-separated, verified platform administrator addresses. Example:

```env
PLATFORM_ADMIN_EMAILS="platform-owner@example.com"
```

The allowlist is server-only. A platform administrator signs in normally and opens `/platform-admin/companies`. Do not use a company owner's address unless that person should administer every company on the SaaS platform.

Approval creates an active tenant, its main branch, the applicant's OWNER membership, default ledger accounts, and the tenant audit event. Rejection stores a reason; rejected applicants can update their details and submit again. Approval is disabled until the applicant's email is verified.

Apply the database migration and regenerate Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```
