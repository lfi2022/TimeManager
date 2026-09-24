import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../../backend/src/app.js';
import { parseEnvironment } from '../../backend/src/config.js';
import { AuthService } from '../../backend/src/modules/auth/auth.service.js';

const appUrl = process.env.DATABASE_URL!;
const password = process.env.DEVELOPMENT_SEED_PASSWORD!;
const prisma = new PrismaClient({ datasources: { db: { url: appUrl } } });
const config = parseEnvironment({
  NODE_ENV: 'test',
  DATABASE_URL: appUrl,
  SESSION_SECRET: 'test-session-secret-with-at-least-thirty-two-characters',
  LOGIN_RATE_LIMIT_MAX: '2',
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
});
const app = await buildApp(config, { prisma });

function firstCookie(value: string | string[] | undefined) {
  const cookie = Array.isArray(value) ? value[0] : value;
  if (!cookie) throw new Error('Cookie is missing.');
  return cookie.split(';')[0]!;
}

let csrfCookie = '';
let csrfToken = '';
beforeAll(async () => {
  const csrf = await app.inject('/api/auth/csrf');
  csrfCookie = firstCookie(csrf.headers['set-cookie']);
  csrfToken = csrf.json().data.csrfToken;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('authentication', () => {
  it('requires CSRF and authenticates a tenant user with HttpOnly session', async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        companySlug: 'secret-company-a',
        email: 'worker-a@tempopoint.test',
        password,
      },
    });
    expect(denied.statusCode).toBe(403);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { cookie: csrfCookie, 'x-csrf-token': csrfToken },
      payload: {
        companySlug: 'secret-company-a',
        email: 'worker-a@tempopoint.test',
        password,
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.headers['set-cookie']).toContain('SameSite=Lax');
    const sessionCookie = firstCookie(login.headers['set-cookie']);
    const me = await app.inject({
      url: '/api/me',
      headers: { cookie: sessionCookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.user.companyId).toBeDefined();
    expect(me.json().data.user.email).toBe('worker-a@tempopoint.test');
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: sessionCookie + '; ' + csrfCookie,
        'x-csrf-token': csrfToken,
      },
    });
    expect(logout.statusCode).toBe(204);
    expect(
      (await app.inject({ url: '/api/me', headers: { cookie: sessionCookie } }))
        .statusCode,
    ).toBe(401);
  });

  it('keeps platform authentication separate', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/platform-auth/login',
      headers: { cookie: csrfCookie, 'x-csrf-token': csrfToken },
      payload: { email: 'platform-admin@tempopoint.test', password },
    });
    expect(login.statusCode).toBe(200);
    const cookie = firstCookie(login.headers['set-cookie']);
    expect(
      (await app.inject({ url: '/api/platform/me', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: '/api/me', headers: { cookie } })).statusCode,
    ).toBe(401);
  });

  it('invalidates sessions on a password reset', async () => {
    const service = new AuthService(prisma, config);
    const loggedIn = await service.loginUser({
      companySlug: 'secret-company-a',
      email: 'worker-a@tempopoint.test',
      password,
    });
    expect(loggedIn).not.toBeNull();
    const token = await service.issueUserReset(
      'secret-company-a',
      'worker-a@tempopoint.test',
    );
    expect(token).toBeTruthy();
    expect(
      await service.resetUserPassword({ token, password: password + 'x' }),
    ).toBe(true);
    expect(await service.userSession(loggedIn!.token)).toBeNull();
    expect(
      await service.loginUser({
        companySlug: 'secret-company-a',
        email: 'worker-a@tempopoint.test',
        password,
      }),
    ).toBeNull();
    expect(
      await service.loginUser({
        companySlug: 'secret-company-a',
        email: 'worker-a@tempopoint.test',
        password: password + 'x',
      }),
    ).not.toBeNull();
  });
});
