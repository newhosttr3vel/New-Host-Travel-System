# Testing and quality checks

## Automated commands

Run npm run lint, npm run typecheck, npm test and npm run build.

The GitHub Actions workflow runs those commands for pushes to main and pull requests. It uses placeholder values for environment variables and has no production database credentials or deployment step.

## Current coverage

Unit tests check role grants, read-only restrictions, and fail-closed handling for unknown roles.

## Required test additions

- Registration, login, session expiry and password-reset behavior.
- Tenant onboarding and duplicate-workspace behavior.
- PostgreSQL migrations and Prisma integration tests.
- Customer create, validation, update, archival, pagination, search and audit events.
- Cross-tenant read, write, archive and export denial.
- Supplier and reservation state transitions.
- Hotel allocation concurrency limits.
- Decimal financial calculations, payment allocation, refunds and balanced ledger posting.
- Secure file delivery.
- Arabic RTL, English LTR, keyboard accessibility and responsive browser tests.

Only report checks as passing after a completed GitHub Actions run (or an actual local invocation) confirms them. Build success alone does not prove business workflows or tenant boundaries are safe.
