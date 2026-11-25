# Booking-file financial summary

This read-only endpoint gives finance-authorized users a consolidated view of financial documents already linked to the service reservations inside one booking file.

## Endpoint

`GET /api/booking-files/{id}/financial-summary`

Requires the existing `finance:read` permission. The booking file, service reservations, customer invoices and supplier bills are all queried with the authenticated tenant context and the caller's branch scope. An inaccessible or missing booking file returns `404 NOT_FOUND`.

## Response

The response contains:

- Booking-file reference and B2B customer identity.
- Every service reservation, including archived service lines so historical financial documents are not silently hidden.
- Linked non-void customer invoices and their paid/outstanding amounts.
- Linked non-void supplier bills, supplier identity and their paid/outstanding amounts.
- A currency summary for estimated service amounts, customer receivables and supplier payables.

All amounts are returned as decimal strings and aggregated with integer cents. EGP, SAR, USD and other currencies are kept in separate groups; this endpoint does not invent exchange rates or combine unlike currencies.

## Financial definitions and boundaries

- **Estimates** come from the reservation's sale and cost snapshots. The displayed gross margin is an estimate, not a posted or realized profit.
- **Receivables** come from customer invoices linked through `reservationId`; collected amounts use the invoice's posted `paidAmount` snapshot.
- **Payables** come from supplier bills linked through `reservationId`; paid amounts use the bill's posted `paidAmount` snapshot.
- Documents with `VOID` status remain visible in the service history but are excluded from totals and have a null outstanding amount.
- Unlinked invoices or supplier bills are not attributed to a booking file.
- No invoice, receipt, supplier bill, payment, allocation or journal entry is created or changed by this endpoint.

This is a booking-level financial visibility slice. It is not a substitute for the general ledger, trial balance, bank reconciliation, customer/supplier statements or realized-margin reporting.
