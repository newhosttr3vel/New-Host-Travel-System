# Interim storage: Google Sheets

Google Sheets is the temporary record store for this early version. It is not a relational database and must not be treated as a production accounting ledger.

## Workbook tabs

The spreadsheet configured by `GOOGLE_SHEETS_ID` is initialized by the app with the following tabs and headers:

- `Tenants`: company workspaces and defaults.
- `Memberships`: Google identity IDs assigned to a workspace and role.
- `Branches`: workspace branches reserved for the next implementation slice.
- `Customers`: company-scoped customer records.
- `Suppliers`: company-scoped hotels and other providers.
- `Reservations`: customer-linked travel service records.
- `AuditEvents`: operational audit rows.

Do not rename these tabs or change the header row. The service account requires Editor access to this one spreadsheet. Keep the spreadsheet private; never publish it to the web.

## Limitations

Google Sheets does not provide relational foreign-key enforcement or multi-row transactions. The adapter scans rows and updates by spreadsheet range; simultaneous edits can conflict. Keep this for a small trusted team and fake/sample data only.

## Moving later

The API handlers scope records to the authenticated user's workspace. Replace the adapter in `src/lib/sheets-store.ts` with a database-backed repository and migrate rows by stable IDs when the project outgrows Sheets.
