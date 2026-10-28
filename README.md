# New Host Travel System

A bilingual (Arabic/English) travel-agency workspace for customer, supplier, and reservation management.

## Current prototype

- Next.js App Router + React.
- Google sign-in via NextAuth with signed JWT sessions; no separate user/session database is used in this interim version.
- Google Sheets as temporary application storage.
- Company workspace membership and server-side role permissions.
- Customer and supplier records, reservations, soft archival, and audit events.
- GitHub Actions lint, type-check, unit tests, and production build.

## Run locally

Requires Node.js 22.18 or newer.

1. Copy `.env.example` to `.env.local`.
2. Configure the Google OAuth web client and service account by following [the deployment guide](docs/DEPLOYMENT.md).
3. Run `npm install`.
4. Run `npm run dev` and open `http://localhost:3000`.

The Google service account must be shared as an Editor on the spreadsheet. The app creates its data tabs and headers on first connection.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render + Google Sheets + Google OAuth setup. GitHub Pages is not suitable because the app needs server routes and server-only credentials.

## Limitations

This is an early foundation, not a complete travel ERP or production-certified accounting system. Google Sheets has no relational constraints or multi-row transactions. Test with fake data first. Before storing real customer, financial, or passport information, add remaining security controls and move to a proper database. Double-entry accounting and invoice/payment workflows are not implemented yet.
