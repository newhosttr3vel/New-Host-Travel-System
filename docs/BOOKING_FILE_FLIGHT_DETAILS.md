# Booking-file flight details

This is the first operational flight-detail slice for the master booking file. It stores itinerary segments, a passenger manifest and ticket references. It does not issue tickets or connect to an airline/GDS provider.

## API

Create a flight service through `POST /api/booking-files`. The request still requires the normal tenant-scoped customer, branch and supplier fields and a UUID `idempotencyKey`.

```json
{
  "customerId": "customer-id",
  "branchId": "branch-id",
  "idempotencyKey": "8e03978e-40d5-43e8-bc93-6894a57f9324",
  "services": [
    {
      "serviceType": "FLIGHT",
      "supplierId": "airline-supplier-id",
      "currency": "EGP",
      "saleAmount": "12500.00",
      "costAmount": "10800.00",
      "flightDetails": {
        "bookingReference": "ABC123",
        "ticketingDeadline": "2026-12-10T18:00:00+02:00",
        "segments": [
          {
            "carrierCode": "MS",
            "flightNumber": "985",
            "originCode": "CAI",
            "destinationCode": "JED",
            "departureAt": "2026-12-20T08:00:00+02:00",
            "arrivalAt": "2026-12-20T12:00:00+03:00",
            "cabinClass": "ECONOMY",
            "baggageAllowance": "1PC"
          }
        ],
        "passengers": [
          {
            "fullName": "EXAMPLE PASSENGER",
            "passengerType": "ADULT",
            "nationality": "EG",
            "ticketStatus": "PENDING"
          }
        ]
      }
    }
  ]
}
```

## Validation rules

- A flight service requires an active supplier in the same company with category `AIRLINE`.
- At least one segment and one passenger are required; the current limits are 12 segments and 20 passengers per flight service.
- Airport codes are three uppercase letters. Carrier codes are two or three uppercase alphanumeric characters.
- Segment timestamps must include a timezone offset. Arrival must be after departure and segments must be chronological without overlap.
- Passenger names are required. Nationality, when supplied, is a two-letter code.
- Ticket numbers are optional while the ticket status is `PENDING`; an `ISSUED` ticket must include a number. Ticket numbers cannot repeat within one flight service.
- Passport numbers, passport scans and other identity documents are intentionally not stored in these flight tables. They belong in a separately permissioned document workflow.

## Responses and access

- New booking file: HTTP 201.
- Same idempotency key and same normalized request: HTTP 200 replay of the original file.
- Same key with different request data or inaccessible branch scope: HTTP 409.
- Validation errors: HTTP 400; branch authorization failures: HTTP 403.
- The booking file and all flight records are written in the same PostgreSQL transaction.
- All three flight tables enforce tenant isolation with PostgreSQL RLS and are registered in the tenant-context Prisma wrapper.
- The booking-file read API returns flight segments and passenger ticket status. Cost fields continue to be masked without `finance:read`.

## Explicit limitations

This slice does not perform ticket issuance, ticket exchange/void/refund, seat selection, live availability, fare revalidation, airline/GDS integration, passport processing or financial posting. Creating a flight service does not create an invoice, receipt, supplier bill, payment or journal entry.
