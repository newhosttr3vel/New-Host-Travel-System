# New Host Travel System

An original travel-agency ERP with a path toward a secure multi-tenant SaaS platform.

## Product direction

The application is intended to support travel agency operations, including customer and supplier management, quotations, reservations, Umrah and Hajj operations, travel services, documents, and financial workflows. The architecture must enforce tenant isolation and server-side authorization throughout.

## Technology baseline

- Next.js App Router, React, and strict TypeScript
- PostgreSQL
- Prisma ORM (stable v7 baseline until Prisma ORM 8 is generally available)
- Server-side business logic and validation
- Automated quality checks and documented deployment

## Development status

This repository was initially empty. The first milestone establishes a verifiable application foundation before adding further operational modules.

- [ ] Application shell and bilingual Arabic/English layout
- [ ] Data model and versioned database migrations
- [ ] Authentication and tenant-aware authorization
- [ ] Core customers, suppliers, quotations, and reservations
- [ ] Financial workflows and audit trail
- [ ] Automated tests and deployment documentation

No production deployment, live integrations, or production accounting readiness is claimed at this stage.

## Local development

The project requires a supported Node.js LTS version and a PostgreSQL database. See [Environment setup](docs/ENVIRONMENT.md) and [Deployment](docs/DEPLOYMENT.md) as these are added.

## Security

Never commit real credentials, customer passports, or financial data. Use environment variables and fictional development seed records only.
