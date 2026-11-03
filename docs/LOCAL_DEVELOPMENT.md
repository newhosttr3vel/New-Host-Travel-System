# Local-first development

This project starts as a local web app on your own computer. The app is opened at
http://localhost:3000; the PostgreSQL container is published only on 127.0.0.1:54329 and is not
bound to your LAN interface. These commands do not configure a cloud database or public hosting.

## Requirements

- Node.js 22.18.0 or newer
- npm (included with Node.js)
- Docker Desktop with Docker Compose, running before the first start

## Start on Windows

1. Open PowerShell or Terminal in the repository folder.
2. Run: npm run local:start
3. On the first run, the helper creates .env with a unique authentication secret, starts PostgreSQL
   locally, installs dependencies, runs Prisma generation and migrations, then starts the web app.
4. Open http://localhost:3000 and register the owner account. Complete company/workspace onboarding.

The startup helper deliberately refuses an existing .env that points somewhere other than the local
database. It does not silently overwrite environment settings or connect to a cloud database. Review
.env manually if this happens; do not paste its secrets into chats or GitHub.

## Stop and restart

- Press Ctrl+C in the terminal to stop the web app.
- Run: npm run local:stop to stop the database container. The named data volume is retained, so
  your saved data remains on this computer.
- Run: npm run local:start again to start the database and app.

Do not use docker compose down -v unless you intentionally want to delete the local database volume.

## Backups

- npm run local:backup writes a PostgreSQL custom-format dump to backups/.
- Backups are ignored by Git and must be copied somewhere safe outside the computer for disaster
  protection.
- To restore, stop the web app, then run:
  npm run local:restore -- "backups/your-backup.dump"
  The script requires the literal confirmation RESTORE and creates a safety backup before applying
  the restore.

## Current limitations

Local startup makes the existing foundation easier to run; it does not mean the accounting ERP is
complete. Customers, suppliers, reservations, authentication and initial workspace onboarding are
present. Quotes, invoices, receipts, supplier bills, a balanced double-entry ledger, advanced travel
operations and the full production security checklist remain release work. Use fictional data while
the finance and security workflows are being implemented and tested.
