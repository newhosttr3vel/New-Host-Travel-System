# Booking-file visa details

This is the initial structured visa-application capture slice for a booking-file VISA service. It records the destination, visa type, entry type, application status and applicant names. It does not submit an application to an authority or claim that a visa has been issued.

## API

Create a visa service through `POST /api/booking-files`. The request requires a same-company active supplier categorized as `VISA_PROVIDER`, a normal tenant-scoped customer and branch, and a UUID `idempotencyKey`.

```json
{
  "customerId": "customer-id",
  "branchId": "branch-id",
  "idempotencyKey": "a8bb95e4-4a37-44fd-9c38-17c80a86c1d0",
  "services": [
    {
      "serviceType": "VISA",
      "supplierId": "visa-provider-id",
      "currency": "EGP",
      "saleAmount": "4500.00",
      "costAmount": "3900.00",
      "visaDetails": {
        "destinationCountryCode": "SA",
        "visaType": "UMRAH",
        "entryType": "SINGLE",
        "status": "DRAFT",
        "stayDurationDays": 30,
        "applicants": [
          {
            "fullName": "EXAMPLE APPLICANT",
            "nationality": "EG",
            "dateOfBirth": "1990-01-01"
          }
        ]
      }
    }
  ]
}
```

## Validation and persistence

- Destination country and applicant nationality use two-letter uppercase country codes.
- A visa service requires an active same-tenant supplier categorized as `VISA_PROVIDER`.
- Each visa service requires 1–20 applicants.
- New visa records always start in `DRAFT`; clients cannot set `SUBMITTED`, `APPROVED` or `ISSUED` during creation.
- Submission and every later status transition must be performed by a future audited workflow that records the real action time and actor.
- The database prevents blank applicant names, invalid country codes, non-positive stay durations, reversed validity windows, and an `ISSUED` record without issue and validity dates.
- Visa details and applicants are saved in the same transaction as the booking file and reservation.
- Both tables have tenant RLS, composite tenant foreign keys and runtime-role grants.

## Privacy boundary

This first slice deliberately does not store passport numbers, passport scans, identity-document images or other passport credentials. Those belong in the protected document workflow.

The booking-file read API returns applicant names and the initial draft status to users with `reservations:read`. Application references, nationality and date of birth are masked unless the caller has `documents:read`. Costs remain masked unless the caller has `finance:read`.

## Explicit limitations

This is not visa issuance or authority integration. It does not upload documents, validate passport eligibility, submit applications, process fees, handle rejection reasons, or implement approved/issued/rejected/cancelled status transitions. It does not create invoices, receipts, supplier bills, payments or journal entries. Those require separate audited workflows.
