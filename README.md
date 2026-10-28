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

The repository began as a foundation, not a finished travel ERP or a production-certified SaaS release. Supplier create, edit, archive, search and pagination are implemented, as are reservation create, list, edit, archive and controlled status transitions. A first finance foundation now includes a tenant-scoped chart of accounts, immutable posted journals, decimal-safe debit/credit validation, a base-currency trial balance, and reversing entries. Automated quotation-to-invoice/collection posting, supplier bills/payments, bank reconciliation, advanced hotel inventory, visas, Hajj/Umrah operations, document generation, subscriptions and provider integrations remain to be built.

## Local-first setup (recommended for the first release)

The first release is intended to run on your own computer before any public hosting is configured. The local database is a Docker volume on this computer, and its published port is bound to 127.0.0.1 only.

Requirements:
- Node.js 22.18.0 or newer
- npm
- Docker Desktop with Docker Compose, running

From the repository folder, run:

    npm run local:start

The first run creates a local .env and a unique authentication secret, starts PostgreSQL, installs dependencies if needed, applies database migrations, and launches the site. Then open http://localhost:3000 and register the owner account.

Useful local commands:

- npm run local:stop — stop the local database container without deleting saved data.
- npm run local:backup — create a database backup in backups/.
- npm run local:restore -- "backups/your-backup.dump" — restore a backup after explicit confirmation.

See docs/LOCAL_DEVELOPMENT.md for details and troubleshooting. Do not use docker compose down -v unless you intentionally want to delete your local database volume.

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
