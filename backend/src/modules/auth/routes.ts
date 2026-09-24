import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth.service.js';
import { createTenantContextFromIdentity } from '../../tenancy/context.js';
import { OrganizationService } from '../organization/organization.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { WorkEntryService } from '../work-entries/work-entry.service.js';
import { TimeBalanceService } from '../time-balance/time-balance.service.js';

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
      message: 'Authentification non configurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e.',
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
      if (
        typeof body?.companySlug === 'string' &&
        typeof body.email === 'string'
      )
        await auth.issueUserReset(body.companySlug, body.email);
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
            message: 'Jeton invalide ou expirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.',
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
          message: 'AccÃƒÆ’Ã‚Â¨s administrateur requis.',
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
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' },
    });

  app.get(
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
    async (request, reply) =>
      reply.code(201).send({
        data: {
          user: await organizationService!.createUser(
            tenant(request),
            request.body,
          ),
        },
      }),
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
  app.get('/api/work-entries', { preHandler: requireUser }, async (r) => ({
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
      const x = await workEntries!.decide(
        tenant(r),
        (r.params as { id: string }).id,
        false,
        (r.body as { reason?: string }).reason,
      );
      return x ? { data: { entry: x } } : notFound(reply);
    },
  );  app.get('/api/time-balance',{preHandler:requireUser},async r=>({data:{minutes:await balances!.balance(tenant(r),(r.query as {userId?:string}).userId),transactions:await balances!.history(tenant(r),(r.query as {userId?:string}).userId)}}));
  app.post('/api/admin/time-balance/adjust',{preHandler:[requireCsrf,requireAdmin]},async(r,reply)=>{const x=await balances!.adjust(tenant(r),r.body);return x?reply.code(201).send({data:{transaction:x}}):notFound(reply)});
}
