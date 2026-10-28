# Deployment guide

No live deployment has been configured or performed by this milestone. These steps are preparation guidance, not evidence of an existing live service.

## Requirements

- A supported Node.js LTS runtime compatible with the project's engine requirement.
- PostgreSQL and a restricted database role.
- HTTPS domain and hosting provider that supports Next.js server routes.
- Protected environment variables or a secret manager.
- Private persistent object storage before travel documents are implemented.
- Logs, health monitoring, automated backups and a tested restore procedure.

## Release steps

1. Configure DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL and BETTER_AUTH_TRUSTED_ORIGINS.
2. Run lint, typecheck, tests and production build.
3. Apply the checked-in migration with npm run db:migrate before sending live traffic.
4. Deploy the reviewed commit using a server runtime, then test login, workspace creation, customer workflow and /api/health.
5. Configure DNS and HTTPS, secure cookies, logging and uptime alerts.
6. Back up PostgreSQL and prove a restore works before business data is introduced.
7. Document release rollback and database migration rollback strategy.

Do not seed demo data in production. Do not enable subscription billing until server-verified payment webhooks or authorized manual approval are implemented. Never describe a successful push as a deployment.
