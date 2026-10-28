# Database schema

PostgreSQL is the persistent source of truth. The schema is in prisma/schema.prisma; the checked-in initial SQL migration is under prisma/migrations/20261028000000_init.

## Main entities

- User, Session, Account, Verification: Better Auth identity and session records.
- Tenant: separate agency workspace with language, currency, time-zone and status.
- TenantMembership: user access and role in an agency.
- Branch: agency branch records.
- Customer: individual and corporate customers.
- Supplier: hotels, airlines, transport providers, visa processors, tour operators and other vendors.
- Reservation: early reservation record foundation including service type, status, dates, currency, sale price and cost.
- AuditEvent: workspace-scoped audit trail.

## Integrity constraints

- Operational records reference a tenant.
- Memberships are unique per (tenantId, userId).
- Branch slugs are unique within a tenant.
- Customer and supplier IDs have tenant-scoped unique constraints.
- Reservation references are unique within a tenant.
- Reservation customer/supplier foreign keys include tenantId; cross-workspace links fail at database level.
- Reservation prices use DECIMAL(14,2).
- Customer records have archivedAt to support soft archiving.

## Migration workflow

Local schema changes: npm run db:migrate:dev -- --name describe_change, then npm run db:generate.

Deployment: npm run db:migrate.

Never edit an already-applied production migration. Add a new migration for each schema change.
