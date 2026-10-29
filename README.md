# New Host Travel System

A bilingual (Arabic-first) travel-agency workspace with a foundation for a secure multi-tenant ERP.

## What's in this milestone

- Next.js App Router, React and strict TypeScript
- PostgreSQL persistence through Prisma ORM 7 and the PostgreSQL adapter
- Email/password registration and session handling through Better Auth
- New-company onboarding with an owner membership
- Tenant-scoped customer directory with search, pagination, create, edit and archive
- Tenant-scoped dashboard counts and latest customer records from PostgreSQL
- Arabic RTL by default and English LTR via the language control
- Server-side role-to-permission checks, audit events on customer changes and security headers
- Initial PostgreSQL migration, optional fictional demo seed, and GitHub Actions quality workflow

The repository began as a foundation, not a finished travel ERP or a production-certified SaaS release. Supplier create, edit, archive, search and pagination are implemented, as are reservation create, list, edit, archive and controlled status transitions. A first finance milestone now includes a tenant-scoped chart of accounts, immutable posted journals, decimal-safe debit/credit validation, a base-currency trial balance, and reversing entries. Customer invoices and partial/full receipt posting are implemented in `release/web-v1`, including tax payable lines, idempotency keys, concurrency checks on collection, audit events, and links to the source journal. Remaining finance work includes cancellation/reversal workflows for invoices and receipts, supplier bills/payments, credit notes/refunds, allocations, bank reconciliation, and more reporting. Advanced hotel inventory, visas, Hajj/Umrah operations, document generation, subscriptions and provider integrations remain to be built.

## Browser-based development in GitHub Codespaces (no local installation)

The project can be edited and run in a cloud development environment from your browser. You do not need to install Node.js, Docker, or an editor on your computer.

1. Switch GitHub to branch `release/web-v1`.
2. Click **Code → Codespaces → Create codespace on release/web-v1**.
3. On first creation, Codespaces installs dependencies, starts a PostgreSQL development database, applies migrations, and creates an ignored `.env`.
4. The site starts when the Codespace attaches. Open the private forwarded port 3000 from the Codespaces **Ports** panel.

See [docs/CODESPACES.md](docs/CODESPACES.md) for details.

**GitHub Pages is not a runtime for this full-stack ERP.** It publishes static files only, while this project needs Next.js server routes, authentication, and PostgreSQL. A complete live release will need a host that supports the app server and database. Keep this Codespace database for fictional development data only; do not use it as the permanent company database.

## Future hosted deployment

GitHub Pages cannot run this full-stack app. No public deployment is configured or claimed. When the local workflows and security checks are ready, see docs/DEPLOYMENT.md to plan hosted deployment separately.

## Quality checks

Run npm run lint, npm run typecheck, npm test and npm run build. See docs/TESTING.md for current coverage and limitations.

## Documentation

- docs/ARCHITECTURE.md — architecture and data boundaries
- docs/DATABASE.md — schema and migrations
- docs/SECURITY.md — security posture and remaining requirements
- docs/ENVIRONMENT.md — environment variables
- docs/LOCAL_DEVELOPMENT.md — local-only startup, backups and restore
- docs/DEPLOYMENT.md — future deployment preparation
- docs/ROADMAP.md — implementation checklist

## Important security notes

- Do not enter production customer records, passport information, or real financial data until the production security checklist is complete.
- Keep .env, local database backups, and any real customer or financial data out of Git. The repository is public.
- Configure secrets using environment variables or a secret manager; never commit .env.
- Tenant-aware application queries are implemented for the customer workflow. PostgreSQL row-level security, independent cross-tenant penetration tests, branch-level authorization, and production monitoring are not yet complete.
- Live airline/hotel inventory, ticket issuance, government approval, payment processing, email delivery and WhatsApp messages are not available unless their respective authorized integrations are implemented and configured.
