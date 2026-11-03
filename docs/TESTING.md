# Testing and quality checks

## Automated commands

Run npm run lint, npm run typecheck, npm test and npm run build.

The GitHub Actions workflow runs those commands for pushes to main and pull requests. It uses placeholder values for environment variables and has no production database credentials or deployment step.

## Current coverage

Unit tests check role grants (including inherited JavaScript object-property names), read-only restrictions, fail-closed handling for unknown roles, reservation lifecycle transitions, and loading all pages of customer/supplier/hotel directory options. PostgreSQL integration tests cover balanced billing journals, hotel reservation persistence, reservation relationship tenant isolation, and concurrent onboarding attempts. The current CI workflow applies migrations before running database integration tests.

## Remaining test additions

- Registration, login, session expiry and password-reset behavior.
- Tenant-aware API authorization failures, including read, update, archive and export attempts against another tenant.
- Customer and supplier CRUD validation, pagination, search and audit events.
- Cross-tenant API read, update, archive and export denial (current integration test covers database-enforced reservation relationship isolation).
- Supplier contract workflows and reservation concurrency/idempotency.
- Hotel allocation concurrency limits.
- Decimal financial calculations, payment allocation, refunds and balanced ledger posting.
- Secure file delivery.
- Arabic RTL, English LTR, keyboard accessibility and responsive browser tests.

`package-lock.json` is committed. CI uses `npm ci` when the lockfile is present, runs the dependency audit, and stores both the lockfile and JSON audit report as workflow artifacts. The latest CI audit reports zero known vulnerabilities.

Only report checks as passing after a completed GitHub Actions run (or an actual local invocation) confirms them. Build success alone does not prove business workflows or tenant boundaries are safe.
