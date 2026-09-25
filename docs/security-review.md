# Security review

The API routes use authenticated tenant context derived from server-side sessions. Tenant identifiers supplied by clients are rejected by strict Zod schemas or ignored. Tenant tables, including subscriptions and notifications, use PostgreSQL RLS and are accessed through `withTenant` or explicit platform support context.

Mutation routes require the signed CSRF cookie and header. Login routes use Fastify rate limiting. Cookies are secure in production, HTTP-only where applicable and SameSite=Lax. Structured logs redact authorization and cookie headers. API errors are normalized and do not expose Prisma errors.

Validation executed before this review: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, and `git diff --check`.