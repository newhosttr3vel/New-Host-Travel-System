# Booking File and Multi-Service Reservation Architecture

## Status

**Decision record — design only.** This document describes an additive implementation path. It does not change the Prisma schema, migrations, API behavior, or production data.

## 1. Current model and the gap

The current `Reservation` record already represents one service line. It contains a tenant, branch, B2B customer, optional supplier, service type, operational status, service dates, currency, sale amount, cost amount and notes.

The service types already defined are:

- `HOTEL`
- `FLIGHT`
- `VISA`
- `TRANSPORT`
- `UMRAH_PACKAGE`
- `HAJJ_PACKAGE`
- `TOUR`
- `OTHER`

Hotel-specific information is stored in `HotelReservationDetail`, `HotelReservationRoom` and `HotelReservationNightRate`. Customer invoices and supplier bills can reference a `Reservation`, so the service record is already connected to financial documents.

The missing concept is a **master booking file** that groups several service reservations for the same customer and trip. Creating a parallel service table would duplicate existing fields and require migrating existing invoice, supplier-bill, hotel-detail and document relationships.

## 2. Decision

Introduce a tenant-scoped `BookingFile` master record and keep `Reservation` as the service-level record.

Add a nullable `bookingFileId` to `Reservation` with a composite relation to `BookingFile` using `[bookingFileId, tenantId]`. A booking file can therefore contain one or more existing reservations without duplicating service, supplier, cost, selling-price or status fields.

**Do not introduce a second `BookingService` table in the first implementation.** The current `Reservation` model already has the required service-line identity and financial links. Reuse it to keep the first migration small and preserve current integrations.

### BookingFile — proposed fields

| Field | Purpose |
|---|---|
| `id` | Stable master identifier |
| `tenantId` | Mandatory company boundary |
| `branchId` | Owning branch |
| `customerId` | Contracting B2B customer |
| `reference` | Human-readable master booking number, unique per tenant |
| `createdById` | User who opened the file, if actor relations are added |
| `assignedToId` | Optional responsible employee, if assignment is introduced |
| `createdAt`, `updatedAt` | Audit timestamps |
| `archivedAt` | Optional soft archive; never hard-delete financial history |

Use composite unique keys such as `[id, tenantId]` and `[tenantId, reference]`. Add indexes for `[tenantId, customerId, createdAt]` and `[tenantId, branchId, createdAt]`.

Each attached `Reservation` remains a service line with its own supplier, dates, currency, cost, sale amount and operational status. The API must validate that the service and master file have the same tenant, customer and branch. The composite tenant foreign key prevents cross-company attachment at the database level; customer/branch equality must also be enforced transactionally and covered by tests.

## 3. Backward-compatible migration

The migration must be additive and preserve all existing reservation IDs and financial links.

1. Create `booking_files` with tenant, branch, customer, reference and timestamps.
2. Add nullable `bookingFileId` to `reservations`.
3. Add the composite foreign key from `reservations(bookingFileId, tenantId)` to `booking_files(id, tenantId)`.
4. Backfill one master file for every existing reservation, including archived reservations, and link that reservation to the new file.
5. Preserve the existing reservation reference as the initial booking-file reference. The two references live in separate tables and each remains unique within its own table.
6. Keep `invoices.reservationId`, `supplier_bills.reservationId`, hotel details and documents unchanged. Their existing links continue to work through the service reservation.
7. Add the booking-file table to the same tenant RLS model as other tenant-owned tables. Enable and force RLS, grant only the required runtime privileges, and use the established transaction-local tenant context.

The backfill must be deterministic and run in the migration transaction. It must not delete, rewrite or renumber existing reservations, invoices, supplier bills, journal entries or payments.

## 4. Financial source of truth

Do not copy totals onto `BookingFile` in the first release. Duplicated totals can drift when a service is amended, an invoice is voided, a supplier bill is adjusted or a payment is reversed.

Use separate, clearly labelled figures:

- **Expected sale / expected cost:** sum of the linked reservations' `saleAmount` and `costAmount`.
- **Posted customer sales:** sum of non-void invoices linked to the file's service reservations.
- **Customer collections:** sum of posted customer payments allocated to those invoices.
- **Supplier liabilities:** sum of non-void supplier bills linked to the service reservations.
- **Supplier payments:** sum of posted supplier payments against those bills.
- **Estimated margin:** expected sale minus expected cost.
- **Posted margin:** posted revenue less posted supplier costs, using the accounting engine's posted source documents.

Never add expected reservation amounts to posted invoice totals in the same KPI. Show the definition, currency and reporting period for each figure. Preserve the exchange-rate snapshot and base-currency accounting already held by financial documents.

For the first release, keep invoices and supplier bills service-linked. A later, separately reviewed change may add master-file-level billing for consolidated invoices; it must define allocation across service lines before implementation.

## 5. Service-specific detail strategy

Keep the shared `Reservation` model focused on common service fields. Retain the existing hotel detail tables. Add separate one-to-one detail models only when their workflows are ready, for example:

- `FlightReservationDetail`: segments, airline locator, ticket numbers, issue status and passenger assignment.
- `VisaReservationDetail`: destination, visa type, applicant checklist, submission, decision, issue and expiry dates.
- `TransportReservationDetail`: route, pickup/drop-off, vehicle, passenger count and supplier confirmation.
- `PackageReservationDetail`: Umrah/Hajj/tour program, departure, group capacity, inclusions and traveller allocation.

Each detail model must carry `tenantId` and use composite foreign keys to its parent reservation. Do not place passports or sensitive traveller documents in an untyped JSON blob. A dedicated traveller/document permission model is required before those records are exposed to staff.

## 6. API and UI rollout

### Phase A — additive data layer

- Add `BookingFile` and the nullable reservation relation.
- Backfill legacy records.
- Add tenant RLS and composite foreign keys.
- Keep existing reservation endpoints and response contracts working.

### Phase B — booking-file read API

- Add a tenant- and branch-scoped list endpoint with pagination.
- Search by master reference, service reference and customer.
- Return service lines with per-service status and supplier.
- Return expected and posted financial summaries as separate values.
- Enforce existing `reservations:read` and `finance:read` permissions; hide costs and financial summaries when the caller lacks finance access.

### Phase C — create and amend

- Add a booking-file create endpoint that creates the master and all requested service reservations in one transaction.
- Require at least one valid service line for a confirmed file.
- Validate customer, branch and supplier ownership before writes.
- Reuse the existing reservation validation and hotel-pricing logic rather than bypassing it.
- Preserve idempotency for retried create/payment requests.
- Record audit events for file creation, service addition, amendment, cancellation and archive.

The legacy `/api/reservations` endpoint must remain compatible. If it creates a standalone service after the migration, it should create/link a one-service booking file within the same transaction, without changing the legacy response fields relied on by the current UI.

### Phase D — workspace screens

- Booking-file register with customer, master reference, service mix, next service date, operational summary and balance summary.
- Booking-file detail page with a shared header and separate service cards/tabs.
- Each service card opens its own detail form and status timeline.
- Keep the existing reservation register available during rollout; remove it only after parity and user acceptance are verified.

## 7. Required acceptance tests

### Migration and compatibility

- A database with existing reservations backfills exactly one booking file per reservation.
- Reservation IDs, references, statuses, dates, currencies, sale/cost amounts and archived state remain unchanged.
- Existing hotel details, invoices, supplier bills, documents and journal links still resolve.
- A fresh database can apply the complete migration chain and generate Prisma Client.

### Tenant and branch isolation

- A tenant A reservation cannot be attached to a tenant B booking file.
- A service with a different customer or branch cannot be attached to a booking file.
- A user in tenant A cannot list, read, amend or archive tenant B booking files.
- Branch-scoped users see and change only services in their assigned branches.
- Users without `finance:read` never receive service costs or finance totals.

### Workflow and accounting

- One booking file can contain hotel + flight + visa + transport services.
- Each service retains its own supplier, status, dates, currency, cost and selling price.
- Adding or cancelling one service does not silently overwrite the other services.
- Expected totals and posted invoice/bill/payment totals do not double-count.
- Repeated create and payment requests remain idempotent.
- Audit history records the actor and affected file/service.

## 8. Explicit non-goals for the first implementation

- No replacement of the existing `Reservation` model.
- No bulk rewrite of invoice or supplier-bill foreign keys.
- No automatic exchange-rate conversion of service-line totals.
- No inventory/allotment allocation or overbooking engine.
- No traveller passport storage until traveller-level permissions and secure document handling are designed.
- No production data migration or deployment as part of this design-only change.

## 9. Implementation gate

Before the schema PR is opened, verify the exact Prisma relation shape and generated SQL against the current schema, run migrations against both an empty PostgreSQL database and a fixture containing legacy reservations, and run the full RLS, branch-scope, finance-permission and accounting regression suites.

The implementation PR should remain separate from authentication/company-onboarding work and must not be merged into `release/web-v1` without explicit approval.
