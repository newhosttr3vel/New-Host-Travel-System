# New Host Travel — Travel Operations ERP Blueprint

## Product direction

New Host Travel is being developed as a company operating system for a travel agency, not as a generic CRM with a dashboard. The workflow reference is the travel ERP category represented by RMS: a single operating environment for reservations, hotel room inventory/allotment, Hajj and Umrah services, visas, transport, suppliers and financial control.

This document defines the product behavior to build. It does not claim that unfinished modules are already implemented.

## The central operating record

The booking file is the spine of the system. A booking must connect, without re-entering the same information:

1. The customer or contracting agency.
2. One or more travellers / pilgrims and their controlled travel documents.
3. The quotation, price versions, currency and approval history.
4. The requested services: hotel, flight, visa, transfer, transport, Umrah/Hajj package, tour or other service.
5. The supplier, contract, service dates, cost and confirmed reference for each service.
6. Payments collected from the customer and amounts payable to suppliers.
7. Operational tasks, deadlines, files, notes and status history.
8. The final service completion and financial result.

A service line may have its own lifecycle, but must remain attached to the master booking file. Changes must be auditable.

## Target navigation and modules

| Area | Main work | Current state |
|---|---|---|
| Command center | Follow-up queue, booking pipeline, upcoming activity and company KPIs | Initial live-data cockpit and grouped navigation implemented |
| CRM & sales | Leads, customer profiles, corporate accounts, quotations, follow-ups and conversion | Customer directory exists; leads and quotation workflow remain |
| Booking desk | Master booking files, service lines, statuses, confirmations, amendments and cancellations | Basic reservation CRUD and controlled status changes exist |
| Traveller / pilgrim records | Traveller profiles, passport data, document checklist, group manifests and rooming lists | Not implemented |
| Hajj & Umrah | Packages, groups, departure dates, package costing, traveller allocation and readiness checks | Not implemented |
| Hotels & room inventory | Hotel master data, room types, supplier contracts, date-based allotments, release dates, availability and allocation | Supplier directory exists; inventory/contracts/allocation not implemented |
| Flights & tickets | Flight segments, passenger assignment, ticket numbers, issue status and changes | Not implemented |
| Visas | Visa applications, document checks, submission, approval/rejection, issue and expiry tracking | Role exists; workflow not implemented |
| Transport & ground operations | Transfers, vehicles, routes, manifests, pickup times, supplier assignment and execution status | Not implemented |
| Supplier management | Supplier profiles, contacts, contracts, rate periods, service confirmation and payables | Supplier directory and initial bill/payment APIs exist; contract/rate screens remain |
| Finance | Customer invoices, receipts, supplier bills/payments, ledger, reconciliation and profitability | Double-entry foundation, invoices/receipts and supplier billing APIs exist; major finance controls remain |
| Tasks & communications | Assigned tasks, SLA/deadline, reminders, internal notes and event-linked notifications | Not implemented |
| Team, branches & access | Branches, staff, role templates, per-module permissions and audit trail | Tenant roles and branch model exist; invitation and branch-level access UI remain |
| Reports & settings | Sales, production, supplier exposure, inventory, visa readiness, profitability and company settings | Not implemented |

## Core workflows

### 1. Lead → quotation → booking

- A new inquiry is captured with source, owner, customer and requested travel services.
- The salesperson builds a quotation from service lines, supplier cost, selling price, margin, taxes and currency.
- Quotation revisions are retained; approval is explicit when required.
- Accepting a quotation converts it into a booking file while preserving the accepted price snapshot.
- A quotation must not consume hotel or group inventory until it reaches the configured hold/confirmation stage.

### 2. Booking → services → delivery

- Each booking contains service lines and assigned owners.
- Hotel, flight, visa, transport and package work is tracked separately but linked to the same booking.
- Confirmation requires valid supplier references and availability checks where applicable.
- Changes, cancellations, refunds and supplier penalties are recorded as events; historical records are not silently overwritten.
- A booking can be marked complete only when its required services reach their completion conditions.

### 3. Hotel contracts and allotments

- Maintain hotel, city, property, room type, occupancy and contract period.
- Define contracted inventory by room type and service date, including release/cut-off dates and agreed cost/rate.
- Track contracted, reserved, sold, released and remaining inventory as ledger-like movements.
- Allocation must run in a database transaction and prevent concurrent overbooking.
- Rooming lists allocate named travellers to rooms and validate occupancy.

### 4. Hajj / Umrah groups and traveller readiness

- A departure/group has package, dates, capacity, route, hotels, transport, flight details and responsible team.
- Traveller records are linked to a group and booking; passport/document data is entered once and reused under strict permissions.
- Readiness checks aggregate visa, document, ticket, hotel, transport and payment statuses.
- Missing or rejected items create visible work for a named owner rather than being hidden in notes.

### 5. Finance and control

- Financial events originate from validated business events (approved quotation, invoice, receipt, supplier bill, supplier payment, refund, adjustment).
- Posted journals are immutable; corrections use reversal entries and retain links to their source documents.
- Amounts preserve transaction currency, base currency and the exchange-rate snapshot used at posting.
- Customer receipts and supplier payments support allocations and statements.
- Reports distinguish booked sales, collected cash, supplier liabilities, realized margin and outstanding balances.

## Interaction and UX principles

- Arabic RTL is the primary interface; English LTR is supported across the same workflows.
- The workspace should feel like an operating desk: compact navigation grouped by work, dense but readable tables, strong filters, date ranges, clear status labels, quick actions and persistent booking references.
- Every operational detail page should show the master booking context, timeline, linked services, money and documents.
- Avoid dashboard vanity metrics. KPIs must come from persisted records with a visible period and definition.
- Do not show disabled modules as functioning pages. New navigation entries are added when their underlying workflow and permissions are ready.
- Important actions (confirmation, allocation, issue, cancellation, posting) require server-side validation, transaction safety and an audit event.

## Security and production gates

- Keep every record scoped to its tenant and, where enabled, its branch.
- Apply least-privilege access to traveller/passport data, finance, user management and support access.
- Do not put passport scans, real customer details or financial records into demo environments.
- Require row-level tenant isolation review, backup/restore verification, dependency checks, audit review and operational monitoring before production use.
