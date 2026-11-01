# Roadmap and implementation checklist

The target product workflow is documented in [TRAVEL_ERP_BLUEPRINT.md](./TRAVEL_ERP_BLUEPRINT.md). This roadmap separates real implemented functionality from the remaining travel operations ERP scope.

## Milestone 1 — Foundation and first live workflows
- [x] Establish Next.js / TypeScript / PostgreSQL / Prisma / Better Auth foundation.
- [x] Define tenant and membership model, role grants, initial company entities and audit events.
- [x] Implement bilingual Arabic-first workspace, authentication and onboarding.
- [x] Implement tenant-scoped customer and supplier directories.
- [x] Implement reservation records with controlled status transitions.
- [x] Implement tenant-scoped chart of accounts and immutable double-entry journals.
- [x] Implement customer invoices/receipts and initial supplier bill/payment APIs.
- [x] Rework the workspace navigation into company operating sections.
- [x] Add an initial live-data command center with booking pipeline, follow-up queue and recent booking files.
- [ ] Complete registration/login route tests and cross-tenant API authorization tests.
- [ ] Complete PostgreSQL row-level security and independent tenant-isolation review.

## Milestone 2 — Sales and booking lifecycle
- [ ] Add lead capture, lead ownership, follow-up activities and source tracking.
- [ ] Add quotation builder with service lines, supplier cost, selling price, margin, tax and currency snapshots.
- [ ] Add quotation versions, approvals, expiry and conversion into a booking file.
- [ ] Expand booking files to support multiple linked services, travellers, files, notes and event history.
- [ ] Add safe amendment, cancellation and refund workflows.
- [ ] Add booking references, duplicate protection and concurrency-safe transitions.

## Milestone 3 — Hotel contracting and room inventory
- [ ] Add hotel/property master data and room types with occupancy rules.
- [ ] Add supplier hotel contracts, rate seasons, currency and validity periods.
- [ ] Add date-based allotments, release dates, stop-sell and inventory movement history.
- [ ] Add availability search by city, hotel, room type and date range.
- [ ] Add concurrency-safe room allocation and overbooking prevention.
- [ ] Add rooming lists linking travellers to room allocations.

## Milestone 4 — Hajj, Umrah and traveller operations
- [ ] Add traveller/pilgrim profiles and protected document vault.
- [ ] Add Umrah/Hajj packages, groups, departures, capacities and costing.
- [ ] Add group manifests, traveller assignment and readiness checklist.
- [ ] Add flight segments, tickets and passenger assignment.
- [ ] Add visa applications, document checks, status transitions, issue and expiry tracking.
- [ ] Add transport, route, vehicle, pickup and execution workflows.

## Milestone 5 — Supplier, finance and operations control
- [ ] Add supplier contracts, service rates, confirmations and performance history.
- [ ] Add supplier-bill and supplier-payment screens.
- [ ] Add credit notes, refunds, allocations, customer/supplier statements and bank reconciliation.
- [ ] Add tasks, assignment, deadlines, escalation and internal notifications.
- [ ] Add operational reports: booking production, service readiness, hotel utilization and outstanding actions.
- [ ] Add financial reports: revenue, collections, supplier exposure, cash flow and realized margin.

## Milestone 6 — Team, branches and production readiness
- [ ] Add invitations, staff administration, branch-specific access and approval limits.
- [ ] Add full audit views and controlled access to sensitive travel documents.
- [ ] Complete PostgreSQL row-level security, tenant/branch penetration tests and permission review.
- [ ] Add backups, restore verification, retention policies and monitoring.
- [ ] Add end-to-end accessibility, responsive, localization and workflow tests.
- [ ] Prepare a production host, database, HTTPS domain and rollback plan.

## Current product status

The current release is a working foundation with real customer, supplier, reservation and finance workflows. It is not yet a complete RMS-class travel ERP. Only features verified with persistence, permission checks and tests should be treated as complete. Use fictional data until the remaining security and operational controls are complete.
