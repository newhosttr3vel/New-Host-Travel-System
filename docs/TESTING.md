# Testing and quality checks

## Automated commands

Run npm run lint, npm run typecheck, npm test and npm run build.

The GitHub Actions workflow runs those commands for pushes to main and pull requests. It uses placeholder values for environment variables and has no production database credentials or deployment step.

## Current coverage

Unit tests check role grants, read-only restrictions, fail-closed handling for unknown roles, and reservation lifecycle transitions. The current successful CI workflow also applies the initial migration to PostgreSQL and runs a database integration test proving that composite tenant foreign keys reject reservations linking to another tenant's customer or supplier.

## Required test additions

- Registration, login, session expiry and password-reset behavior.
- Tenant onboarding duplicate-workspace behavior and tenant-aware API authorization failures.
- Customer and supplier CRUD validation, pagination, search and audit events.
- Cross-tenant API read, update, archive and export denial (current integration test covers database-enforced reservation relationship isolation).
- Supplier contract workflows and reservation concurrency/idempotency.
- Hotel allocation concurrency limits.
- Decimal financial calculations, payment allocation, refunds and balanced ledger posting.
- Secure file delivery.
- Arabic RTL, English LTR, keyboard accessibility and responsive browser tests.

Only report checks as passing after a completed GitHub Actions run (or an actual local invocation) confirms them. Build success alone does not prove business workflows or tenant boundaries are safe.
