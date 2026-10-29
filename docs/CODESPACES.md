# Work entirely in the browser with GitHub Codespaces

This setup runs the development environment in GitHub Codespaces. It does not require installing Node.js, Docker, or an editor on your computer.

## Open the project

1. Open this repository on GitHub.
2. Switch the branch to `release/web-v1`.
3. Click **Code**, open the **Codespaces** tab, and choose **Create codespace on release/web-v1**.
4. On first creation, Codespaces builds a cloud development container, starts PostgreSQL in a private Compose network, installs dependencies, generates Prisma, applies migrations, and creates an ignored `.env` with a random development-only authentication secret.
5. Wait for the browser editor to open. The development server starts when the Codespace attaches, and GitHub forwards port 3000 privately. If you do not see the preview, open the **Ports** panel and open port 3000.

## Where the data lives

- PostgreSQL runs inside this Codespace environment, not on your PC.
- The Compose volume is intended to persist through ordinary stops/starts of the same Codespace, but this is a development database, not a reliable production database or backup strategy.
- Do not enter real customer, passport, or company financial data. Use fictional test records until production hosting, security review, and a tested backup/restore process are complete.
- Keep port 3000 private to your GitHub account.
- `.env` and database files are not committed to the repository.

## Stop / resume

Use the Codespaces menu to stop the environment when finished and resume it later. Keep the Codespace rather than deleting it if you need its development database. Deleting a Codespace may delete its development data.

## GitHub Pages limitation

GitHub Pages hosts static HTML/CSS/JavaScript. This project needs Next.js server routes, authentication, and PostgreSQL, so Pages cannot run the current full-stack ERP as-is. Codespaces is the browser-based development environment; a later live release must run on a host that supports the Next.js server and database. A static Pages demo can be created separately, but it would not be the complete ERP.
