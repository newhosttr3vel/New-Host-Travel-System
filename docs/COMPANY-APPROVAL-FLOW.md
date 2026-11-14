# Owner-controlled company and employee access

The installation is reserved for New Host Travel. Public sign-up is disabled: the Better Auth server hook accepts only the configured `SYSTEM_OWNER_EMAIL` address. The `/register` screen is available only for the first owner account and redirects to `/login` after that account exists.

Set the following server-side environment variable in Codespaces and production:

```env
SYSTEM_OWNER_EMAIL="newhosttr3vel@gmail.com"
```

The first owner signs up with that exact address, verifies the email in production, and completes the company application/onboarding process. Approval provisions the tenant, main branch, OWNER membership and default ledger accounts. The platform approval tools are restricted to the same verified system-owner identity.

## Employee accounts

After the owner has an active OWNER membership, the owner can open `/team` from the workspace navigation and create employee accounts. Each account is created with a name, unique email address, password of at least 12 characters and a restricted company role. User, credential account, tenant membership and audit event are committed in one transaction.

The employee roles offered by this screen do not include OWNER, ADMINISTRATOR or HR_MANAGER. The server API independently checks the verified `SYSTEM_OWNER_EMAIL` and OWNER membership; hiding the navigation item is not the security boundary. Employee sign-up through the public registration endpoint remains blocked.

Employee passwords are stored using Better Auth's compatible password hashing helper. Because the owner creates the employee account directly, the account is marked email-verified at creation; the owner should only create accounts for staff whose identity has been confirmed.

## Database and validation

Apply the pending database migrations and regenerate Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
npm run lint
npm run typecheck
npm test
```

Do not deploy this change until PostgreSQL/RLS integration tests and a browser test of owner-created employee sign-in have passed.
