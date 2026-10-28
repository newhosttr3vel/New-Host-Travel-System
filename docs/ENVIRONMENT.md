# Environment configuration

Copy .env.example to .env for local work. The real .env file is ignored by Git.

| Variable | Required | Purpose |
|---|---:|---|
| DATABASE_URL | Yes | PostgreSQL connection string |
| BETTER_AUTH_SECRET | Yes for production | Secret used by Better Auth; use at least 32 random characters |
| BETTER_AUTH_URL | Yes for deployment | Canonical public application origin |
| BETTER_AUTH_TRUSTED_ORIGINS | Yes for deployment | Comma-separated origins permitted by Better Auth |
| SEED_DEMO_DATA | Optional | Only the literal value true enables fictional demo seed data; seed refuses production |

Generate a development or production secret with: openssl rand -base64 32

Do not reuse the example password or secret, and do not use production credentials in CI. Create a dedicated PostgreSQL application role with only the permissions needed by the running app. Run migrations using a migration role if production policy requires that separation.
