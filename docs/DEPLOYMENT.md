# Deployment: Next.js + Google Sheets

This is a full-stack Next.js application and cannot run as a static GitHub Pages site. It needs a Node.js host for Google sign-in, API routes, server-side permissions, and private Sheets API credentials.

## 1. Prepare Google Cloud

1. Open the Google Cloud Console and select or create a project.
2. Enable **Google Sheets API**.
3. Create a service account and generate a JSON key. Keep the JSON key private.
4. Copy the service account email and share only the target spreadsheet with that email as **Editor**. Do not make the spreadsheet public or enable "Anyone with the link".
5. Configure the OAuth consent screen and create an OAuth Client ID of type **Web application**.
6. In Authorized JavaScript origins, add the website origin, such as `https://YOUR-SERVICE.onrender.com`.
7. In Authorized redirect URIs, add `https://YOUR-SERVICE.onrender.com/api/auth/callback/google`.

## 2. Deploy the repository

1. Create a Render **Web Service** and connect `newhosttr3vel/New-Host-Travel-System`. For testing, choose branch `feature/google-sheets-storage`; merge it to main only after review.
2. Choose Node.js. Build command: `npm install && npm run build`. Start command: `npm run start`.
3. Set private environment variables in Render:
   - `GOOGLE_SHEETS_ID`: `1PnGlC91BQcGINC4hCwCRzXFWsZfyt9a1Ym13Mw1YxKM`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: email from service account setup
   - `GOOGLE_PRIVATE_KEY`: private key from the service account JSON (keep secret; represent line breaks as `\n`)
   - `GOOGLE_CLIENT_ID`: OAuth web client ID
   - `GOOGLE_CLIENT_SECRET`: OAuth web client secret
   - `NEXTAUTH_URL`: exact HTTPS Render URL
   - `NEXTAUTH_SECRET`: a strong random value of at least 32 characters
4. Open `/api/health`. Expected success JSON: `{"status":"ok","storage":"google_sheets"}`. A degraded result means the account, spreadsheet ID, API enablement, or share permissions need checking.
5. Sign in using the intended Google account, create a workspace, then test customers, suppliers, and reservations with fake data.

## Important

Google Sheets is temporary storage, not a transactional accounting database. Do not store passport scans, payment-card details, or sensitive customer/finance data until access controls, backup/recovery, and migration to a database have been assessed. Review [Google Sheets API usage limits](https://developers.google.com/workspace/sheets/api/limits).
