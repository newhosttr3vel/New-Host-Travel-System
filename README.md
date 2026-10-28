# New Host Travel System

A bilingual (Arabic-first) travel-agency workspace with a foundation for a secure multi-tenant SaaS ERP.

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

The repository began empty. This is an initial working foundation, not a finished travel ERP or a production-certified SaaS release. Suppliers and reservations have schema foundations only; their complete operational workflows, finance, inventory, visas, Hajj/Umrah operations, documents, subscriptions and provider integrations remain to be built.

## Prerequisites

- Node.js 22.18+ (use a currently supported Node.js LTS)
- PostgreSQL 16+ or a compatible managed PostgreSQL service
- npm

## Local setup

1. Copy .env.example to .env.
2. Set DATABASE_URL to a local development PostgreSQL database.
3. Generate BETTER_AUTH_SECRET with: openssl rand -base64 32
4. Keep BETTER_AUTH_URL=http://localhost:3000 and BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000 for local development.
5. Install dependencies and generate Prisma Client with: npm install && npm run db:generate
6. Apply the checked-in initial migration with: npm run db:migrate
7. Start the application with: npm run dev
8. Open http://localhost:3000, create an account, then complete company onboarding.
9. To add fictional test records, set SEED_DEMO_DATA=true in a non-production environment and run npm run db:seed. The seed does not create login credentials.

## Quality checks

Run npm run lint, npm run typecheck, npm test and npm run build. See docs/TESTING.md for current coverage and limitations.

## Documentation

- docs/ARCHITECTURE.md — architecture and data boundaries
- docs/DATABASE.md — schema and migrations
- docs/SECURITY.md — security posture and remaining requirements
- docs/ENVIRONMENT.md — environment variables
- docs/DEPLOYMENT.md — deployment preparation
- docs/ROADMAP.md — implementation checklist

## Important security notes

- Do not enter production customer records, passport information, or real financial data until the production security checklist is complete.
- Configure secrets using environment variables or a secret manager; never commit .env.
- Tenant-aware application queries are implemented for the customer workflow. PostgreSQL row-level security, independent cross-tenant penetration tests, branch-level authorization, and production monitoring are not yet complete.
- Live airline/hotel inventory, ticket issuance, government approval, payment processing, email delivery, and WhatsApp messages are not available unless their respective authorized integrations are implemented and configured.
- No live deployment is configured or claimed at this stage.
