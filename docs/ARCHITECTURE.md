# Architecture

- Next.js App Router provides pages and API handlers.
- React client components provide the bilingual Arabic/English interface.
- NextAuth v4 signs users in through Google and uses signed JWT sessions; no separate user/session database is used in this interim version.
- Google Sheets API stores workspace metadata, memberships, customers, suppliers, reservations, and audit rows in separate tabs.
- Zod validates request payloads and `src/lib/permissions.ts` performs server-side role checks.
- Each operational row includes `tenantId`; API handlers scope reads and writes to the membership associated with the authenticated Google identity.

## Current limitations

Google Sheets does not enforce relational foreign keys, row-level database policies, or multi-row transactions. The adapter scans records in memory and updates rows by spreadsheet range. This is for early testing with low concurrency only. It is not production-ready for critical financial, passport, or customer information. Accounting double-entry, branch-level permissions, team invitations, backup/restore, and migration to a proper database remain future work.
