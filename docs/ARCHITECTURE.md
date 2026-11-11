# Architecture

## Current application layout

- Next.js App Router supplies routes and server-rendered pages.
- React client components handle forms, locale toggling and customer directory interactions.
- Better Auth supplies email/password authentication and persistent sessions.
- Tenant context resolves the authenticated user and verifies their membership in a company workspace.
- Permission grants provide server-side checks by role and operation.
- Prisma ORM 7 with the PostgreSQL adapter accesses the persistent database.
- Zod validates onboarding and customer API payloads.
- GitHub Actions runs lint, type checking, unit tests and production build on push and pull request.

## Data boundaries

A tenant represents one travel agency. TenantMembership binds a user to a tenant and a role. Customers, suppliers, branches, reservations and audit events have a tenantId. Customer endpoints scope reads and writes to the membership resolved from the authenticated session. Reservation foreign keys include both the related record ID and tenant ID, preventing a reservation in one workspace from being linked to another workspace's customer or supplier.

The optional x-tenant-id header is not accepted as proof of access by itself; the server must match it to the authenticated user's membership. A suspended or cancelled tenant is denied access by the current context helper.

## Conventions

- Business logic belongs in API handlers or service modules, not only in UI controls.
- Validate all request payloads on the server.
- Use soft archival for customers instead of deleting their records.
- Record audit events for tenant onboarding and customer create, update and archive actions.
- Use database decimal types for money. Avoid JavaScript binary floating point in accounting calculations.
- Dashboards must be backed by real database queries, not hardcoded totals.

## Implemented controls and workflows

- Tenant and branch scopes are applied in the reservation, document and finance workflows; PostgreSQL row-level security protects tenant-owned rows through a separate non-owner runtime role.
- Private travel documents use server-side permission checks, MIME validation, random object keys and short-lived signed downloads when the storage provider is configured.
- The finance foundation includes tenant-scoped ledger accounts, immutable balanced journals, customer invoices and receipts, supplier bills and payments, and a base-currency trial balance.
- Mutating workflows write audit events; posted journals are corrected through reversing entries rather than silent edits.
- CI runs PostgreSQL migrations and integration tests using a non-owner runtime login.

## Not yet complete

- Consolidate remaining business rules into shared service modules and expand authenticated integration coverage for every finance mutation and future export.
- Complete lead management, quotations, multi-service booking files, hotel contracts and room allotments, traveller profiles, Hajj/Umrah groups, flight ticketing, visa processing and transport execution.
- Add supplier contracts/rate periods, credit notes/refunds, payment allocations, customer/supplier statements, bank reconciliation and management reports.
- Complete invitations and staff lifecycle, broader end-to-end role/branch testing, independent security assessment, production provider configuration, monitoring and verified backup restore drills.
- Live airline/hotel inventory, government approval, payment processing and external messaging require authorized provider integrations.

The current release is a functional foundation, not a production-certified travel ERP. Use fictional data until the production gates in SECURITY.md and DEPLOYMENT.md are completed.
