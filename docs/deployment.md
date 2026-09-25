# Production deployment

## Prerequisites

- Node.js 24 and pnpm 10.12.4.
- PostgreSQL managed by the operator, with backups enabled.
- A reverse proxy terminating TLS. Set `TRUST_PROXY` only to its actual IP/CIDR.
- A production `.env` copied from `.env.example`; replace every `A_REMPLIR` value. Do not commit it.

## Release

1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `pnpm db:migrate`
4. `pnpm pm2:start`
5. Verify `GET /api/health`, then `pnpm exec pm2 save` and configure `pm2 startup` for the host account.

The application runs a single Fastify process and serves the compiled frontend. Seed data is development-only and must not be run in production.

## Reverse proxy

Proxy HTTPS traffic to `127.0.0.1:3000`, pass `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`, and configure the corresponding proxy address in `TRUST_PROXY`. TLS certificates are managed at the proxy.

## Backup and restore

Schedule `pg_dump --format=custom` for the production database, retain copies according to the customer agreement, and encrypt backup storage. Test restoration regularly in an isolated database with `pg_restore`. Record the date and result of each restoration test.

## Upgrade and rollback

For an upgrade, take a verified backup, deploy the release, run migrations, restart PM2, and check health and logs. For rollback, restore the previous release, then restore the compatible database backup when a migration cannot be rolled back safely. Never delete production data as a rollback shortcut.

## Restart procedure

After a host restart: start PostgreSQL and the reverse proxy, run `pnpm exec pm2 resurrect`, then check `/api/health` and application logs.