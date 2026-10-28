# Deployment guide

The repository is prepared for a managed Node.js web service, for example Render, plus a hosted PostgreSQL database such as Neon. No live deployment has been created yet.

## Important: choose a web service, not a static site

This application uses server-side routes, Better Auth sessions, Prisma and PostgreSQL. Do not deploy it through GitHub Pages or a static-export option; those cannot run the current backend. Use a Node.js web service.

## 1. Create the database

1. Create a PostgreSQL project in Neon.
2. Copy its pooled connection string for the running web app.
3. Also keep the direct connection string for the initial database migration.
4. Do not put either connection string in Git or share it in a chat.

Neon free compute scales to zero after inactivity and has resource limits. This is suitable for a prototype, not a guarantee of always-on production operation.

## 2. Apply the initial migration once

Run this from a trusted local computer with Node.js 22.18+ and Git installed:

1. Clone the private repository and enter its project folder.
2. Run npm install.
3. Copy .env.example to .env.
4. In .env, set DATABASE_URL to the direct Neon connection string.
5. Set BETTER_AUTH_SECRET to a newly generated random secret. One option is openssl rand -base64 32.
6. Keep BETTER_AUTH_URL=http://localhost:3000 and BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000 for this local migration step.
7. Run npm run db:migrate. This creates the initial tables and constraints in the hosted database.
8. Do not run the optional demo seed against a database containing real records.

The .env file is ignored by Git. Never commit credentials.

## 3. Deploy the web application on Render

1. Create a Render account and connect your GitHub account so it can read the private New-Host-Travel-System repository.
2. Choose New, then Web Service. Do not choose Static Site.
3. Select the repository and the main branch.
4. Use Node as the runtime, with build command: npm install && npm run build
5. Use start command: npm run start
6. Select the service name before deploying so you can determine the public onrender.com URL.
7. Add these environment variables in Render's Environment settings:
   - DATABASE_URL: the pooled Neon connection string
   - BETTER_AUTH_SECRET: a fresh random secret, different from any example value
   - BETTER_AUTH_URL: the exact HTTPS URL Render assigned to this service
   - BETTER_AUTH_TRUSTED_ORIGINS: the same exact HTTPS origin, with no trailing slash
   - SEED_DEMO_DATA: false
8. Save the variables and deploy. Check the build logs before using the site.

Render deploys a full Next.js app as a web service. Its free web services can spin down after 15 minutes without inbound traffic and may take time to start again.

## 4. Verify the deployment

1. Open the HTTPS URL Render assigned to the service.
2. Open /api/health and confirm the response says status ok and database connected.
3. Register a test account, create a fictional company workspace, then test customer, supplier and reservation workflows.
4. Test Arabic and English display and confirm a user from one tenant cannot access another tenant's records.
5. Confirm automatic deployments from main work by making a small reviewed source change.

If the build fails, use the exact error in Render's deploy logs. Do not share passwords, auth secrets or full database URLs when asking for help.

## Before real company use

This milestone is not production-certified. Finish API authorization and cross-tenant tests, PostgreSQL row-level security, rate limits, email verification/password recovery, secure document storage, tested backups/restores, logging and security review first. Use fictional test data until those controls are complete. Paid hosting and database plans may be needed for dependable commercial operation.

See the provider's current docs for service limits and billing before choosing a plan.
