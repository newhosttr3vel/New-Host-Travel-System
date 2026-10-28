# Environment variables

Set these in local `.env.local` or the hosting provider's private environment settings. Never commit secrets or paste private keys into GitHub Issues.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_SHEETS_ID` | Spreadsheet ID from the Sheets URL. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Cloud service account shared as Editor on the spreadsheet. |
| `GOOGLE_PRIVATE_KEY` | Private key from the service account JSON key file; store as a secret and represent newlines as `\n` if needed. |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 web client ID used for Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 web client secret. |
| `NEXTAUTH_URL` | Canonical website URL, HTTPS in production. |
| `NEXTAUTH_SECRET` | Random secret of at least 32 characters used for authentication sessions. |

The Google OAuth client and service account are different credentials: the OAuth client signs the user into the website; the service account lets the backend read and update the application spreadsheet.
