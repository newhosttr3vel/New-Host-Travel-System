# Environment configuration

Copy `.env.example` to `.env` during local development. Never commit credentials.

| Variable | Required | Purpose |
|---|---:|---|
| DATABASE_URL | Yes | Migration/admin PostgreSQL connection |
| APP_DATABASE_URL | Production | Non-owner runtime PostgreSQL login that inherits `new_host_app`; local development can fall back to DATABASE_URL |
| BETTER_AUTH_SECRET | Production | At least 32 random characters |
| BETTER_AUTH_URL | Deployment | Canonical public HTTPS origin |
| BETTER_AUTH_TRUSTED_ORIGINS | Deployment | Comma-separated allowed origins |
| RESEND_API_KEY | Production | Resend transactional email API key |
| AUTH_EMAIL_FROM | Production | Verified sender address |
| S3_BUCKET | Production | Private travel-document bucket |
| S3_REGION | Production | S3 region or provider region such as `auto` |
| S3_ENDPOINT | Optional | Custom S3-compatible endpoint |
| S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY | When not using workload identity | Object-storage credentials |
| SEED_DEMO_DATA | Optional | Only literal `true` enables fictional demo data; production seed is blocked |

Generate auth secrets using `openssl rand -base64 32`.

For production, keep separate PostgreSQL credentials: `DATABASE_URL` is used for migrations/admin maintenance; `APP_DATABASE_URL` is used by the running web application and must authenticate as a non-owner login with `NOBYPASSRLS` that inherits the database role `new_host_app`. Never grant the runtime login table ownership or superuser privileges.

Keep Resend and S3 credentials in the hosting provider's secret manager. Do not expose them to browser code, logs, GitHub source files or screenshots.
