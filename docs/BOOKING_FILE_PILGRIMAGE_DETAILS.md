# Booking-file Umrah and Hajj package details

This is the initial tenant-scoped package-detail capture for `UMRAH_PACKAGE` and `HAJJ_PACKAGE` service lines. It records a package itinerary and the traveller manifest for one booking service. It is not a package catalogue, group inventory or readiness workflow.

## API

Create the service through `POST /api/booking-files`. The request requires a same-company active supplier categorized as `TOUR_OPERATOR`, the normal tenant-scoped B2B customer and branch, a UUID `idempotencyKey`, and service dates that match the package departure and return dates.

```json
{
  "customerId": "customer-id",
  "branchId": "branch-id",
  "idempotencyKey": "efea8b9b-1e0e-4dd5-bd3d-45df6d2f21aa",
  "services": [
    {
      "serviceType": "UMRAH_PACKAGE",
      "supplierId": "tour-operator-id",
      "startDate": "2026-12-10",
      "endDate": "2026-12-20",
      "currency": "SAR",
      "saleAmount": "42000.00",
      "costAmount": "36500.00",
      "packageDetails": {
        "packageName": "December Umrah",
        "departureCity": "Cairo",
        "departureDate": "2026-12-10",
        "returnDate": "2026-12-20",
        "groupReference": "UMR-DEC-2026",
        "accommodationLevel": "FOUR_STAR",
        "mealPlan": "BREAKFAST",
        "transportIncluded": true,
        "includedServices": ["Makkah accommodation", "Madinah accommodation", "Ground transfers"],
        "travellers": [
          {
            "fullName": "EXAMPLE PILGRIM",
            "travellerType": "ADULT",
            "nationality": "EG"
          }
        ]
      }
    }
  ]
}
```

For Hajj, use `serviceType: "HAJJ_PACKAGE"`. The stored package type is derived by the server; clients cannot choose a different package type.

## Validation and persistence

- A package service requires an active supplier in the same tenant with category `TOUR_OPERATOR`.
- At least one and at most 50 travellers are accepted per service.
- Traveller names are required; nationality, when supplied, must be a two-letter uppercase code.
- Departure and return dates are required, and the service start/end dates must match them exactly.
- Return date must be later than departure date.
- Accommodation and meal-plan values are controlled enums.
- Package details cannot be attached to hotel, flight, visa, transport, tour or other service types.
- Package detail and traveller rows are saved in the same PostgreSQL transaction as the booking file and reservation.
- Both tables use composite tenant foreign keys, RLS and FORCE RLS, and are registered in the tenant-context Prisma wrapper.
- The read API returns traveller names to reservation readers; traveller nationality is masked unless the caller has `documents:read`. Costs remain masked unless the caller has `finance:read`.

## Privacy and financial boundaries

This slice does not store passport numbers, passport scans, date of birth, medical data or identity-document images. Those belong in a separate protected traveller/document workflow.

Creating a package service does not reserve group capacity, allocate rooms, issue tickets or visas, confirm supplier inventory, create invoices, collect receipts, create supplier bills/payments or post journal entries. Sale and cost amounts remain reservation snapshots; financial posting must happen through the audited finance workflows.

## Follow-up

- Package catalogue and supplier contract/rate versions.
- Group departures, capacity, waitlists and concurrency-safe allocation.
- Rooming lists and hotel/transport assignments.
- Traveller readiness checklist for visa, documents, flight, hotel and payment.
- Operational status transitions and audit timeline.
- Invoice, receipt, supplier bill and payment linkage with realized margin reporting.
