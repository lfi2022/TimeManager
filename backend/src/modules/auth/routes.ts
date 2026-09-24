import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth.service.js';

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
      message: 'Authentification non configurée.',
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
            message: 'Jeton invalide ou expiré.',
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
}
