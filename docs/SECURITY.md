# Security notes

- Keep the spreadsheet private and share it only with the backend service account and trusted administrators.
- Never commit `.env.local`, OAuth client secrets, or service-account JSON/private keys.
- Keep `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLIENT_SECRET`, and `NEXTAUTH_SECRET` in the host's encrypted environment settings.
- The browser never receives the Google service-account credentials. Sheets API requests run on the server.
- APIs use a signed Google-authenticated session, check workspace membership, enforce role permissions, and scope records to `tenantId`.
- Google Sheets has no relational constraints or multi-row transactions. Concurrent edits may conflict; create backups before large edits.
- Use synthetic data while testing. Do not store passport scans, card details, or sensitive customer and finance information yet.
- Before real company use, review rate limiting, account allow-lists or invitations, domain controls, secret rotation, audit completeness, backup/restore drills, and migration to a proper database.
