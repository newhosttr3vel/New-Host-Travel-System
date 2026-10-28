# Roadmap and implementation checklist

## Milestone 1 — Foundation and first real workflow
- [x] Establish repository and baseline commit.
- [x] Add Next.js / TypeScript / PostgreSQL / Prisma / Better Auth foundation.
- [x] Define tenant and membership model, initial business entities, and server-side role grants.
- [x] Implement bilingual workspace shell, authentication screens and language toggle.
- [x] Implement workspace onboarding and tenant-scoped customer CRUD APIs.
- [x] Verify install, migrations, types, lint, tests, and production build in GitHub Actions (run 21 and run 22 succeeded).
- [x] Add PostgreSQL integration test for database-enforced cross-tenant reservation links.
- [ ] Add full registration/login route tests and cross-tenant API authorization tests.

## Milestone 2 — Core CRM and reservations
- [x] Supplier create/update/archive, search and pagination workflows.
- [x] Reservation create/list/update/archive/status transitions with tenant-safe customer/supplier references.
- [ ] Add quotation builder/conversion, reservation idempotency and inventory concurrency.
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
