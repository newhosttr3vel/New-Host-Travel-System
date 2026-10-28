# Security posture and remaining requirements

## Controls in the current slice

- Better Auth manages password storage and session lifecycle.
- Production configuration refuses a missing or too-short BETTER_AUTH_SECRET.
- Protected workspace pages redirect unauthenticated visitors and route newly registered users to workspace onboarding.
- Customer API endpoints check the session, tenant membership, and server-side role permission.
- Customer list, update and archive operations scope each query to the resolved tenant.
- Customer create/update/archive and workspace creation write audit events.
- Validation uses Zod; errors do not return customer records across tenant boundaries.
- Response headers include X-Content-Type-Options, Referrer-Policy, X-Frame-Options and Permissions-Policy.
- Demo seed data is fictional, opt-in and blocked when NODE_ENV=production.

## Must be completed before production use

1. Enable PostgreSQL row-level security with a non-owner application database role and add tests proving tenant isolation.
2. Add rate limiting and login abuse protection. Configure email verification and secure password-reset delivery.
3. Add automated integration and end-to-end tests for login, onboarding and attempts to read, update, archive or export another tenant's data.
4. Add branch-level permissions, invitation lifecycle, review of exceptional support access and immutable financial audit policies.
5. Add private object storage and short-lived authorization for passport and travel-document attachments.
6. Add dependency and secret scanning, database backups, restore drills, observability, incident response and a retention policy.
7. Review HTTPS, cookies, CSP, trusted origins, logging and PostgreSQL grants in the actual hosting environment.
8. Obtain an appropriate independent security review and jurisdiction-specific legal/tax review before relying on the product commercially.

No security certification, country-specific regulatory compliance or production hardening is claimed.
