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

## Not yet complete

Branch-scoped authorization, PostgreSQL row-level security, a separate service layer for all business operations, secure document storage, accounting and double-entry ledger, notification jobs, subscription enforcement and live integrations remain roadmap work. The current slice must not be treated as production-ready simply because it builds.
