# Roadmap and implementation checklist

## Milestone 1 — Foundation and first real workflow
- [x] Establish repository and baseline commit.
- [x] Add Next.js / TypeScript / PostgreSQL / Prisma / Better Auth foundation.
- [x] Define tenant and membership model, initial business entities, and server-side role grants.
- [ ] Implement bilingual workspace shell and authentication screens.
- [ ] Implement workspace onboarding and customer CRUD APIs.
- [ ] Verify install, migrations, types, lint, tests, and production build in CI.
- [ ] Complete registration/login and cross-tenant integration tests.

## Milestone 2 — Core CRM and reservations
- [ ] Supplier create/update/archive workflows.
- [ ] Reservation create/update/state transitions with tenant-safe customer/supplier references.
- [ ] Search, pagination, export authorization, and branch scoping.
- [ ] Customer contacts, duplicate detection, and controlled travel-document data.

## Milestone 3 — Finance
- [ ] Invoices, receipts, supplier bills, allocations, and refunds.
- [ ] Chart of accounts and immutable balanced double-entry ledger.
- [ ] Decimal-safe posting, reversal entries, idempotency, and approval rules.
- [ ] Reports with explicit revenue/cash/cost/margin definitions.

## Milestone 4 — Travel operations
- [ ] Hotel properties, room types, allotments, release dates, and concurrency-safe allocation.
- [ ] Hajj/Umrah packages, group departures, rooming lists, and manifests.
- [ ] Flight/ticket records, visas, transfers, tours, and document templates.

## Milestone 5 — SaaS readiness
- [ ] Tenant invitations, branch-specific access, and support-access audit.
- [ ] Subscription plans, trusted billing webhooks, and feature limits.
- [ ] Notifications, background jobs, email provider, and observability.
- [ ] PostgreSQL row-level security, independent security review, backups, and restore verification.
- [ ] Production deployment, domain, HTTPS, and release rollback plan.

Only features verified with real persistence and tests should be marked complete.
