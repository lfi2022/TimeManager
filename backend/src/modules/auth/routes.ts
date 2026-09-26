import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth.service.js';
import { createTenantContextFromIdentity } from '../../tenancy/context.js';
import { OrganizationService } from '../organization/organization.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { WorkEntryService } from '../work-entries/work-entry.service.js';
import { TimeBalanceService } from '../time-balance/time-balance.service.js';
import { ClockService } from '../clock/clock.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { PeriodLockService } from '../period-locks/period-lock.service.js';
import { SubscriptionService } from '../subscriptions/subscription.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { DomainService } from '../domains/domain.service.js';

const sessionCookie = 'tempopoint_session';
const platformSessionCookie = 'tempopoint_platform_session';
const csrfCookie = 'tempopoint_csrf';

function cookieOptions(secure: boolean, httpOnly = true) {
  return {
    path: '/',
    httpOnly,
    secure,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 31,
  };
}
function csrfValid(request: FastifyRequest, token: string | undefined) {
  const signed = request.cookies[csrfCookie];
  const decoded = signed
    ? request.unsignCookie(signed)
    : { valid: false, value: undefined };
  if (!decoded.valid || !decoded.value || !token) return false;
  const left = Buffer.from(decoded.value);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}
function unavailable(reply: FastifyReply) {
  return reply.code(503).send({
    error: {
      code: 'AUTH_NOT_CONFIGURED',
      message:
        'Authentification non configurÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e.',
    },
  });
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService | undefined,
  secureCookies: boolean,
  rateLimit: { max: number; timeWindow: number },
) {
  app.get('/api/auth/csrf', async (_request, reply) => {
    if (!auth) return unavailable(reply);
    const token = randomBytes(32).toString('base64url');
    return reply
      .setCookie(csrfCookie, token, {
        ...cookieOptions(secureCookies, false),
        signed: true,
      })
      .send({ data: { csrfToken: token } });
  });
  const requireCsrf = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!auth) return unavailable(reply);
    const token =
      typeof request.headers['x-csrf-token'] === 'string'
        ? request.headers['x-csrf-token']
        : undefined;
    if (!csrfValid(request, token))
      return reply.code(403).send({
        error: { code: 'CSRF_INVALID', message: 'Jeton CSRF invalide.' },
      });
  };
  app.post(
    '/api/auth/login',
    { preHandler: requireCsrf, config: { rateLimit } },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      const result = await auth.loginUser(request.body);
      if (!result)
        return reply.code(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Identifiants invalides.',
          },
        });
      return reply
        .setCookie(sessionCookie, result.token, cookieOptions(secureCookies))
        .send({ data: { user: result.identity } });
    },
  );
  app.post(
    '/api/auth/logout',
    { preHandler: requireCsrf },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      await auth.logoutUser(request.cookies[sessionCookie]);
      return reply.clearCookie(sessionCookie, { path: '/' }).code(204).send();
    },
  );
  app.post(
    '/api/auth/change-password',
    { preHandler: requireCsrf },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      const password = (request.body as { password?: unknown })?.password;
      if (typeof password !== 'string' || password.length < auth.configuration.PASSWORD_MIN_LENGTH)
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'Le mot de passe ne respecte pas la longueur minimale.' } });
      const changed = await auth.changePasswordFromSession(request.cookies[sessionCookie], password);
      if (!changed)
        return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Session invalide ou expiree.' } });
      return reply.code(204).send();
    },
  );
  app.get('/api/me', async (request, reply) => {
    if (!auth) return unavailable(reply);
    const session = await auth.userSession(request.cookies[sessionCookie]);
    if (!session)
      return reply.code(401).send({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentification requise.',
        },
      });
    return { data: { user: session.identity } };
  });
  app.post(
    '/api/auth/forgot-password',
    { preHandler: requireCsrf, config: { rateLimit } },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      const body = request.body as { companySlug?: string; email?: string };
      if (typeof body?.companySlug === 'string' && typeof body.email === 'string') { const token=await auth.issueUserReset(body.companySlug, body.email); if(token) await notifications?.email(body.email, 'TempoPoint reset', 'Use this password-reset token: ' + token); }
      return reply.code(202).send({ data: { accepted: true } });
    },
  );
  app.post(
    '/api/auth/reset-password',
    { preHandler: requireCsrf },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      const changed = await auth.resetUserPassword(request.body);
      if (!changed)
        return reply.code(400).send({
          error: {
            code: 'RESET_TOKEN_INVALID',
            message:
              'Jeton invalide ou expirÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©.',
          },
        });
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/platform-auth/login',
    { preHandler: requireCsrf, config: { rateLimit } },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      const result = await auth.loginPlatform(request.body);
      if (!result)
        return reply.code(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Identifiants invalides.',
          },
        });
      return reply
        .setCookie(
          platformSessionCookie,
          result.token,
          cookieOptions(secureCookies),
        )
        .send({ data: { platformUser: result.identity } });
    },
  );
  app.get('/api/platform/me', async (request, reply) => {
    if (!auth) return unavailable(reply);
    const session = await auth.platformSession(
      request.cookies[platformSessionCookie],
    );
    if (!session)
      return reply.code(401).send({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentification requise.',
        },
      });
    return { data: { platformUser: session.identity } };
  });
  app.post(
    '/api/platform-auth/logout',
    { preHandler: requireCsrf },
    async (request, reply) => {
      if (!auth) return unavailable(reply);
      await auth.logoutPlatform(request.cookies[platformSessionCookie]);
      return reply
        .clearCookie(platformSessionCookie, { path: '/' })
        .code(204)
        .send();
    },
  );
  const organizationService = auth
    ? new OrganizationService(auth.database)
    : undefined;
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!auth || !organizationService) return unavailable(reply);
    const session = await auth.userSession(request.cookies[sessionCookie]);
    if (!session)
      return reply.code(401).send({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentification requise.',
        },
      });
    if (session.identity.role !== 'ADMIN')
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message:
            'AccÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨s administrateur requis.',
        },
      });
    (
      request as FastifyRequest & {
        tenantContext?: ReturnType<typeof createTenantContextFromIdentity>;
      }
    ).tenantContext = createTenantContextFromIdentity({
      userId: session.identity.id,
      companyId: session.identity.companyId,
      role: session.identity.role,
    });
  };
  const requirePlatform = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (!auth || !organizationService) return unavailable(reply);
    const session = await auth.platformSession(
      request.cookies[platformSessionCookie],
    );
    if (!session)
      return reply.code(401).send({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentification requise.',
        },
      });
    (request as FastifyRequest & { platformUserId?: string }).platformUserId =
      session.identity.id;
  };
  const tenant = (request: FastifyRequest) =>
    (
      request as FastifyRequest & {
        tenantContext: ReturnType<typeof createTenantContextFromIdentity>;
      }
    ).tenantContext;
  const platformUserId = (request: FastifyRequest) =>
    (request as FastifyRequest & { platformUserId: string }).platformUserId;
  const schedulingService = auth
    ? new SchedulingService(auth.database)
    : undefined;
  const workEntries = auth ? new WorkEntryService(auth.database) : undefined;
  const balances = auth ? new TimeBalanceService(auth.database) : undefined;
  const clock = auth ? new ClockService(auth.database) : undefined;
  const dashboard = auth ? new DashboardService(auth.database) : undefined;
  const audit = auth ? new AuditService(auth.database) : undefined;
  const reports = auth ? new ReportsService(auth.database) : undefined;
  const periodLocks = auth ? new PeriodLockService(auth.database) : undefined;
  const subscriptions = auth ? new SubscriptionService(auth.database) : undefined;
  const notifications = auth ? new NotificationService(auth.database, auth.configuration) : undefined;
  const domains = auth ? new DomainService(auth.database) : undefined;
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' },
    });

  app.get('/api/branding', async r => ({data: domains ? await domains.publicBrand(r.hostname) : {name:'TempoPoint',logoUrl:null,primaryColor:null}}));
  app.get('/api/platform/companies/:id/domains', { preHandler: requirePlatform }, async r => ({data:{domains:await domains!.list((r.params as {id:string}).id)}}));
  app.post('/api/platform/companies/:id/domains', { preHandler: [requireCsrf,requirePlatform] }, async (r,reply) => reply.code(201).send({data:{domain:await domains!.create(platformUserId(r),(r.params as {id:string}).id,r.body)}}));
  app.post('/api/platform/companies/:companyId/domains/:id/verify', { preHandler: [requireCsrf,requirePlatform] }, async (r,reply) => {const x=await domains!.verify(platformUserId(r),(r.params as {companyId:string}).companyId,(r.params as {id:string}).id);return x?{data:x}:notFound(reply);});
  app.patch('/api/platform/companies/:id/branding', { preHandler: [requireCsrf,requirePlatform] }, async r => ({data:{company:await domains!.branding(platformUserId(r),(r.params as {id:string}).id,r.body)}}));  app.get('/api/platform/plans', { preHandler: requirePlatform }, async () => ({data:{plans:await subscriptions!.plans()}}));
  app.get('/api/platform/companies/:id/subscription', { preHandler: requirePlatform }, async r => ({data:await subscriptions!.summary((r.params as {id:string}).id)}));
  app.put('/api/platform/companies/:id/subscription', { preHandler: [requireCsrf,requirePlatform] }, async (r,reply) => {const x=await subscriptions!.assign(platformUserId(r),(r.params as {id:string}).id,r.body);return x?{data:{subscription:x}}:notFound(reply);});
  app.post('/api/platform/companies/:id/suspend', { preHandler: [requireCsrf,requirePlatform] }, async (r,reply) => {const x=await subscriptions!.suspend(platformUserId(r),(r.params as {id:string}).id,true);return x?{data:{subscription:x}}:notFound(reply);});
  app.post('/api/platform/companies/:id/reactivate', { preHandler: [requireCsrf,requirePlatform] }, async (r,reply) => {const x=await subscriptions!.suspend(platformUserId(r),(r.params as {id:string}).id,false);return x?{data:{subscription:x}}:notFound(reply);});
  app.post('/api/platform/companies/:id/support-context', { preHandler: [requireCsrf,requirePlatform] }, async r => ({data:await subscriptions!.supportContext(platformUserId(r),(r.params as {id:string}).id)}));  app.get(
    '/api/platform/companies',
    { preHandler: requirePlatform },
    async () => ({
      data: { companies: await organizationService!.platformCompanies() },
    }),
  );
  app.post(
    '/api/platform/companies',
    { preHandler: [requireCsrf, requirePlatform] },
    async (request, reply) =>
      reply.code(201).send({
        data: {
          company: await organizationService!.createCompany(
            platformUserId(request),
            request.body,
          ),
        },
      }),
  );
  app.patch(
    '/api/platform/companies/:id',
    { preHandler: [requireCsrf, requirePlatform] },
    async (request, reply) => {
      const company = await organizationService!.updateCompany(
        platformUserId(request),
        (request.params as { id: string }).id,
        request.body,
      );
      return company ? { data: { company } } : notFound(reply);
    },
  );
  app.post(
    '/api/platform/companies/:id/activate',
    { preHandler: [requireCsrf, requirePlatform] },
    async (request, reply) => {
      const company = await organizationService!.updateCompany(
        platformUserId(request),
        (request.params as { id: string }).id,
        { active: true },
      );
      return company ? { data: { company } } : notFound(reply);
    },
  );
  app.post(
    '/api/platform/companies/:id/deactivate',
    { preHandler: [requireCsrf, requirePlatform] },
    async (request, reply) => {
      const company = await organizationService!.updateCompany(
        platformUserId(request),
        (request.params as { id: string }).id,
        { active: false },
      );
      return company ? { data: { company } } : notFound(reply);
    },
  );

  app.get('/api/platform/companies/:id/users', { preHandler: requirePlatform }, async (request) => ({ data: { users: await organizationService!.supportUsers(platformUserId(request), (request.params as { id: string }).id) } }));
  app.post('/api/platform/companies/:id/users', { preHandler: [requireCsrf, requirePlatform] }, async (request, reply) => { const user = await organizationService!.supportCreateUser(platformUserId(request), (request.params as { id: string }).id, request.body); return user ? reply.code(201).send({ data: { user } }) : notFound(reply); });
  app.post('/api/platform/companies/:companyId/users/:userId/release-email', { preHandler: [requireCsrf, requirePlatform] }, async (request, reply) => { const user = await organizationService!.supportReleaseUserEmail(platformUserId(request), (request.params as { companyId: string }).companyId, (request.params as { userId: string }).userId); return user ? { data: { user } } : notFound(reply); });
  app.patch('/api/platform/companies/:companyId/users/:userId', { preHandler: [requireCsrf, requirePlatform] }, async (request, reply) => {
    const result = await organizationService!.supportUpdateUser(platformUserId(request), (request.params as { companyId: string }).companyId, (request.params as { userId: string }).userId, request.body);
    if (result.kind === 'not-found') return notFound(reply);
    return { data: { user: result.user } };
  });
  app.get(
    '/api/admin/users',
    { preHandler: requireAdmin },
    async (request) => ({
      data: { users: await organizationService!.users(tenant(request)) },
    }),
  );
  app.get(
    '/api/admin/users/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const user = await organizationService!.user(
        tenant(request),
        (request.params as { id: string }).id,
      );
      return user ? { data: { user } } : notFound(reply);
    },
  );
  app.post(
    '/api/admin/users',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => { const user=await organizationService!.createUser(tenant(request),request.body); await notifications!.email(user.email,'TempoPoint - invitation','Votre compte TempoPoint est prÃªt. Connectez-vous avec le mot de passe communiquÃ© par votre administrateur.'); return reply.code(201).send({data:{user}}); },
  );
  app.patch(
    '/api/admin/users/:id',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => {
      const user = await organizationService!.updateUser(
        tenant(request),
        (request.params as { id: string }).id,
        request.body,
      );
      return user ? { data: { user } } : notFound(reply);
    },
  );
  app.delete(
    '/api/admin/users/:id',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => {
      const user = await organizationService!.deleteUser(
        tenant(request),
        (request.params as { id: string }).id,
      );
      return user ? reply.code(204).send() : notFound(reply);
    },
  );

  app.get(
    '/api/admin/teams',
    { preHandler: requireAdmin },
    async (request) => ({
      data: { teams: await organizationService!.teams(tenant(request)) },
    }),
  );
  app.post(
    '/api/admin/teams',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) =>
      reply.code(201).send({
        data: {
          team: await organizationService!.createTeam(
            tenant(request),
            request.body,
          ),
        },
      }),
  );
  app.patch(
    '/api/admin/teams/:id',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => {
      const team = await organizationService!.updateTeam(
        tenant(request),
        (request.params as { id: string }).id,
        request.body,
      );
      return team ? { data: { team } } : notFound(reply);
    },
  );
  app.delete(
    '/api/admin/teams/:id',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => {
      const removed = await organizationService!.deleteTeam(
        tenant(request),
        (request.params as { id: string }).id,
      );
      return removed ? reply.code(204).send() : notFound(reply);
    },
  );
  app.post(
    '/api/admin/teams/:id/members',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => {
      const member = await organizationService!.addMember(
        tenant(request),
        (request.params as { id: string }).id,
        request.body,
      );
      return member
        ? reply.code(201).send({ data: { member } })
        : notFound(reply);
    },
  );
  app.delete(
    '/api/admin/teams/:id/members/:userId',
    { preHandler: [requireCsrf, requireAdmin] },
    async (request, reply) => {
      const removed = await organizationService!.removeMember(
        tenant(request),
        (request.params as { id: string }).id,
        (request.params as { userId: string }).userId,
      );
      return removed ? reply.code(204).send() : notFound(reply);
    },
  );
  app.get('/api/admin/worksites', { preHandler: requireAdmin }, async (r) => ({
    data: { worksites: await schedulingService!.worksites(tenant(r)) },
  }));
  app.post(
    '/api/admin/worksites',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) => {
      const x = await schedulingService!.saveWorksite(
        tenant(r),
        undefined,
        r.body,
      );
      return reply.code(201).send({ data: { worksite: x } });
    },
  );
  app.patch(
    '/api/admin/worksites/:id',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) => {
      const x = await schedulingService!.saveWorksite(
        tenant(r),
        (r.params as { id: string }).id,
        r.body,
      );
      return x ? { data: { worksite: x } } : notFound(reply);
    },
  );
  app.post(
    '/api/admin/worksites/:id/archive',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) => {
      const x = await schedulingService!.archiveWorksite(
        tenant(r),
        (r.params as { id: string }).id,
      );
      return x ? { data: { worksite: x } } : notFound(reply);
    },
  );
  app.get('/api/admin/schedules', { preHandler: requireAdmin }, async (r) => ({
    data: { schedules: await schedulingService!.schedules(tenant(r)) },
  }));
  app.post(
    '/api/admin/schedules',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) =>
      reply.code(201).send({
        data: {
          schedule: await schedulingService!.saveSchedule(
            tenant(r),
            undefined,
            r.body,
          ),
        },
      }),
  );
  app.patch(
    '/api/admin/schedules/:id',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) => {
      const x = await schedulingService!.saveSchedule(
        tenant(r),
        (r.params as { id: string }).id,
        r.body,
      );
      return x ? { data: { schedule: x } } : notFound(reply);
    },
  );
  app.post(
    '/api/admin/schedule-assignments',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) => {
      const x = await schedulingService!.assign(tenant(r), r.body);
      return x
        ? reply.code(201).send({ data: { assignment: x } })
        : notFound(reply);
    },
  );
  app.get(
    '/api/admin/users/:id/expected-minutes',
    { preHandler: requireAdmin },
    async (r, reply) => {
      const date = new Date(String((r.query as { date?: string }).date));
      if (Number.isNaN(date.getTime()))
        return reply
          .code(400)
          .send({ error: { code: 'BAD_REQUEST', message: 'Date invalide.' } });
      const x = await schedulingService!.expectedMinutes(
        tenant(r),
        (r.params as { id: string }).id,
        date,
      );
      return x ? { data: x } : notFound(reply);
    },
  );
  const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!auth || !workEntries) return unavailable(reply);
    const session = await auth.userSession(request.cookies[sessionCookie]);
    if (!session)
      return reply.code(401).send({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentification requise.',
        },
      });
    (
      request as FastifyRequest & {
        tenantContext?: ReturnType<typeof createTenantContextFromIdentity>;
      }
    ).tenantContext = createTenantContextFromIdentity({
      userId: session.identity.id,
      companyId: session.identity.companyId,
      role: session.identity.role,
    });
  };
  app.get('/api/notifications', { preHandler: requireUser }, async r => ({data:{notifications:await notifications!.mine(tenant(r))}}));
  app.post('/api/notifications/:id/read', { preHandler: [requireCsrf,requireUser] }, async (r,reply) => {const n=await notifications!.read(tenant(r),(r.params as {id:string}).id);return n?{data:{notification:n}}:notFound(reply);});  app.get('/api/work-entries', { preHandler: requireUser }, async (r) => ({
    data: {
      entries: await workEntries!.list(
        tenant(r),
        r.query as {
          status?: never;
          userId?: string;
          teamId?: string;
          date?: string;
        },
      ),
    },
  }));
  app.post(
    '/api/work-entries',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await workEntries!.create(tenant(r), r.body);
      return x ? reply.code(201).send({ data: { entry: x } }) : notFound(reply);
    },
  );
  app.patch(
    '/api/work-entries/:id',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await workEntries!.update(
        tenant(r),
        (r.params as { id: string }).id,
        r.body,
      );
      return x ? { data: { entry: x } } : notFound(reply);
    },
  );
  app.post(
    '/api/work-entries/:id/submit',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await workEntries!.submit(
        tenant(r),
        (r.params as { id: string }).id,
      );
      return x ? { data: { entry: x } } : notFound(reply);
    },
  );
  app.post(
    '/api/work-entries/:id/approve',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await workEntries!.decide(
        tenant(r),
        (r.params as { id: string }).id,
        true,
      );
      return x ? { data: { entry: x } } : notFound(reply);
    },
  );
  app.post(
    '/api/work-entries/:id/reject',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await workEntries!.decide(tenant(r),(r.params as { id: string }).id,false,(r.body as { reason?: string }).reason);
      if (x) await notifications!.notify(tenant(r),x.userId,'WORK_ENTRY_REJECTED','Prestation rejetee',(r.body as { reason?: string }).reason ?? 'Une correction est requise.');
      return x ? { data: { entry: x } } : notFound(reply);
    },
  );
  app.get('/api/time-balance', { preHandler: requireUser }, async (r) => ({
    data: {
      minutes: await balances!.balance(
        tenant(r),
        (r.query as { userId?: string }).userId,
      ),
      transactions: await balances!.history(
        tenant(r),
        (r.query as { userId?: string }).userId,
      ),
    },
  }));
  app.post(
    '/api/admin/time-balance/adjust',
    { preHandler: [requireCsrf, requireAdmin] },
    async (r, reply) => {
      const x = await balances!.adjust(tenant(r), r.body);
      return x
        ? reply.code(201).send({ data: { transaction: x } })
        : notFound(reply);
    },
  );
  app.get('/api/clock/status', { preHandler: requireUser }, async (r) => ({
    data: { session: await clock!.status(tenant(r)) },
  }));
  app.post(
    '/api/clock/start',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await clock!.start(tenant(r), r.body);
      return x
        ? reply.code(201).send({ data: { session: x } })
        : reply.code(409).send({
            error: {
              code: 'CLOCK_ACTIVE',
              message: 'Pointage dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  actif.',
            },
          });
    },
  );
  app.post(
    '/api/clock/stop',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const x = await clock!.stop(tenant(r));
      return x
        ? { data: { entry: x } }
        : reply.code(409).send({
            error: {
              code: 'CLOCK_INACTIVE',
              message: 'Aucun pointage actif.',
            },
          });
    },
  );
  app.post(
    '/api/sync',
    { preHandler: [requireCsrf, requireUser] },
    async (r, reply) => {
      const key = r.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,}$/.test(key))
        return reply.code(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'ClÃƒÆ’Ã‚Â© idempotence invalide.',
          },
        });
      await auth!.database.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'INSERT INTO "SyncMutation" ("id","companyId","userId","payload") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::jsonb) ON CONFLICT ("id") DO NOTHING',
          key,
          tenant(r).companyId,
          tenant(r).userId,
          JSON.stringify(r.body),
        );
      });
      return reply.code(202).send({ data: { synchronized: true } });
    },
  );
  const auditFilters = (q: { action?: string; entityType?: string; from?: string; to?: string }) => Object.fromEntries(Object.entries({ action: q.action, entityType: q.entityType, from: q.from ? new Date(q.from) : undefined, to: q.to ? new Date(q.to) : undefined }).filter(([, value]) => value !== undefined));
  app.get('/api/admin/audit', { preHandler: requireAdmin }, async (r) => ({ data: { events: await audit!.list(tenant(r), auditFilters(r.query as { action?: string; entityType?: string; from?: string; to?: string })) } }));
  app.get('/api/platform/companies/:id/audit', { preHandler: requirePlatform }, async (r) => ({ data: { events: await audit!.listPlatform((r.params as { id: string }).id, auditFilters(r.query as { action?: string; entityType?: string; from?: string; to?: string })) } }));
  app.get('/api/reports/:period', { preHandler: requireUser }, async (r, reply) => { const period=(r.params as { period: string }).period; if (!['daily','weekly','monthly'].includes(period)) return reply.code(400).send({error:{code:'BAD_REQUEST',message:'PÃ©riode invalide.'}}); const date=new Date(String((r.query as {date?:string}).date ?? new Date().toISOString())); if(Number.isNaN(date.getTime())) return reply.code(400).send({error:{code:'BAD_REQUEST',message:'Date invalide.'}}); return {data:await reports!.report(tenant(r),period as 'daily'|'weekly'|'monthly',date)}; });
  app.get('/api/reports/export/csv', { preHandler: requireUser }, async (r,reply) => { const date=new Date(String((r.query as {date?:string}).date ?? new Date().toISOString())); if(Number.isNaN(date.getTime())) return reply.code(400).send({error:{code:'BAD_REQUEST',message:'Date invalide.'}}); return reply.header('content-type','text/csv; charset=utf-8').header('content-disposition','attachment; filename="tempopoint-report.csv"').send(await reports!.csv(tenant(r),date)); });
  app.get('/api/admin/period-locks', { preHandler: requireAdmin }, async (r) => ({data:{locks:await periodLocks!.list(tenant(r))}}));
  app.post('/api/admin/period-locks', { preHandler: [requireCsrf,requireAdmin] }, async (r,reply) => reply.code(201).send({data:{lock:await periodLocks!.lock(tenant(r),r.body)}}));
  app.delete('/api/admin/period-locks/:id', { preHandler: [requireCsrf,requireAdmin] }, async (r,reply) => {const lock=await periodLocks!.unlock(tenant(r),(r.params as {id:string}).id); return lock?reply.code(204).send():notFound(reply);});
  app.post('/api/work-entries/:id/correct', { preHandler: [requireCsrf,requireAdmin] }, async (r,reply) => {const entry=await workEntries!.correct(tenant(r),(r.params as {id:string}).id,r.body); return entry?{data:{entry}}:notFound(reply);});  app.get('/api/dashboard', { preHandler: requireUser }, async (r) => ({
    data: await dashboard!.summary(tenant(r)),
  }));
}
