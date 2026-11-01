# Roadmap and implementation checklist

## Milestone 1 — Foundation and first real workflow
- [x] Establish repository and baseline commit.
- [x] Add Next.js / TypeScript / PostgreSQL / Prisma / Better Auth foundation.
- [x] Define tenant and membership model, initial business entities, and server-side role grants.
- [x] Implement bilingual workspace shell, authentication screens and language toggle.
- [x] Implement workspace onboarding and tenant-scoped customer CRUD APIs.
- [x] Add a PostgreSQL migration workflow and CI quality checks.
- [ ] Add full registration/login route tests and cross-tenant API authorization tests.
- [ ] Complete PostgreSQL row-level security and independent tenant-isolation review.

## Milestone 2 — Core CRM and reservations
- [x] Supplier create/update/archive, search and pagination workflows.
- [x] Reservation create/list/update/archive/status transitions with tenant-safe customer/supplier references.
- [ ] Add quotation builder/conversion, reservation idempotency and inventory concurrency.
- [ ] Add customer contacts, duplicate detection, and controlled travel-document data.
- [ ] Add branch scoping, exports and broader search/reporting.

## Milestone 3 — Finance

### Implemented on `release/web-v1`
- [x] Tenant-scoped chart of accounts and default system accounts.
- [x] Immutable posted double-entry journals with decimal-safe debit/credit validation.
- [x] Base-currency trial balance and reversal-based journal corrections.
- [x] Customer invoice issuance and partial/full receipt posting in the finance workspace.
- [x] Invoice tax lines, idempotency keys, collection concurrency checks and audit events.
- [x] Supplier-bill and supplier-payment API workflows with ledger posting and idempotency.

### Remaining finance work
- [ ] Add supplier-bill and supplier-payment screens to the finance workspace.
- [ ] Add invoice and receipt void/reversal workflows with safe accounting corrections.
- [ ] Add credit notes, refunds, payment allocations and customer/supplier statements.
- [ ] Add bank reconciliation, cash-flow reporting and period-close controls.
- [ ] Add broader finance integration tests, including failure, duplicate and concurrent-posting cases.

## Milestone 4 — Travel operations
- [ ] Hotel properties, room types, allotments, release dates, and concurrency-safe allocation.
- [ ] Hajj/Umrah packages, group departures, rooming lists, and manifests.
- [ ] Flight/ticket records, visas, transfers, tours, and document templates.
- [ ] Supplier contracts, rate validity, quotation builder and confirmed booking workflows.
- [ ] Authorized airline, hotel and other provider integrations.

## Milestone 5 — SaaS readiness
- [ ] Tenant invitations, branch-specific access, and support-access audit.
- [ ] Subscription plans, trusted billing webhooks, and feature limits.
- [ ] Notifications, background jobs, email provider, and observability.
- [ ] PostgreSQL row-level security, independent security review, backups, and restore verification.
- [ ] Production deployment, domain, HTTPS, monitoring and a release rollback plan.
- [ ] Automated end-to-end accessibility, localization and responsive-browser tests.

Only features verified with real persistence and tests should be marked complete. This repository is a working foundation, not a finished travel ERP or a production-certified SaaS release. Use fictional data until the remaining security and operational controls are complete.
