# Security posture and remaining requirements

## Controls in the current slice

- Better Auth manages password storage and session lifecycle.
- Production auth rate limiting is explicitly enabled, with shared PostgreSQL storage and stricter per-endpoint limits for email sign-in (5 attempts/minute) and sign-up (3 attempts/hour).
- Production configuration refuses a missing or too-short BETTER_AUTH_SECRET.
- Protected workspace pages redirect unauthenticated visitors and route newly registered users to workspace onboarding.
- Customer, supplier and reservation API endpoints check the session, tenant membership and server-side role permission.
- Customer/supplier/reservation queries scope records to the resolved tenant; reservation customer and optional supplier relationships are constrained by composite database foreign keys plus a tenant consistency check.
- Workspace creation is serialized per user with a PostgreSQL transaction-scoped advisory lock, preventing parallel first-time onboarding requests from creating duplicate workspaces.
- Workspace creation and customer/supplier/reservation create, update and archive actions write audit events.
- Reservation supplier-cost values are returned and editable only to roles with finance:read; non-finance users cannot set the cost through the API.
- Validation uses Zod; errors do not return customer records across tenant boundaries.
- Response headers include X-Content-Type-Options, Referrer-Policy, X-Frame-Options and Permissions-Policy.
- Demo seed data is fictional, opt-in and blocked when NODE_ENV=production.

## Must be completed before production use

1. Enable PostgreSQL row-level security with a non-owner application database role and add tests proving tenant isolation. The current app-level tenant filters and composite foreign keys are not a substitute for RLS.
2. Configure email verification and secure password-reset delivery; email verification is currently disabled because no mail delivery provider is configured.
3. Add automated integration and end-to-end tests for login, onboarding, and attempts to read, update, archive or export another tenant's data. The new onboarding integration test covers concurrent workspace creation, not the full auth journey.
4. Add branch-level permissions, invitation lifecycle, review of exceptional support access and immutable financial audit policies.
5. Add private object storage and short-lived authorization for passport and travel-document attachments.
6. Commit a generated package-lock.json and switch CI to npm ci for reproducible dependency resolution. The latest reviewed CI install reported 16 moderate npm audit findings; their exact packages and remediation paths must be taken from the generated audit artifact and cleared before production. Add dependency and secret scanning, database backups, restore drills, observability, incident response and a retention policy.
7. Review HTTPS, cookies, CSP, trusted origins, logging and PostgreSQL grants in the actual hosting environment.
8. Obtain an appropriate independent security review and jurisdiction-specific legal/tax review before relying on the product commercially.

No security certification, country-specific regulatory compliance or production hardening is claimed.
