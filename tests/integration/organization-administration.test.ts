import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../../backend/src/app.js';
import { parseEnvironment } from '../../backend/src/config.js';

const databaseUrl = process.env.DATABASE_URL!;
const password = process.env.DEVELOPMENT_SEED_PASSWORD!;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const app = await buildApp(
  parseEnvironment({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: 'test-session-secret-with-at-least-thirty-two-characters',
    LOGIN_RATE_LIMIT_MAX: '20',
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
  }),
  { prisma },
);
function firstCookie(value: string | string[] | undefined) {
  const cookie = Array.isArray(value) ? value[0] : value;
  if (!cookie) throw new Error('Missing cookie');
  return cookie.split(';')[0]!;
}
async function csrf() {
  const response = await app.inject('/api/auth/csrf');
  return {
    cookie: firstCookie(response.headers['set-cookie']),
    token: response.json().data.csrfToken as string,
  };
}
async function login(companySlug: string, email: string) {
  const protection = await csrf();
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { cookie: protection.cookie, 'x-csrf-token': protection.token },
    payload: { companySlug, email, password },
  });
  expect(response.statusCode).toBe(200);
  return {
    ...protection,
    sessionCookie: firstCookie(response.headers['set-cookie']),
  };
}

let adminA: Awaited<ReturnType<typeof login>>;
let adminB: Awaited<ReturnType<typeof login>>;
let managerAId: string;
let workerBId: string;
beforeAll(async () => {
  adminA = await login('secret-company-a', 'admin-a@tempopoint.test');
  adminB = await login('secret-company-b', 'admin-b@tempopoint.test');
  const usersA = await app.inject({
    url: '/api/admin/users',
    headers: { cookie: adminA.sessionCookie },
  });
  const usersB = await app.inject({
    url: '/api/admin/users',
    headers: { cookie: adminB.sessionCookie },
  });
  expect(usersA.statusCode).toBe(200);
  expect(usersB.statusCode).toBe(200);
  managerAId = usersA
    .json()
    .data.users.find(
      (user: { email: string }) => user.email === 'manager-a@tempopoint.test',
    ).id;
  workerBId = usersB
    .json()
    .data.users.find(
      (user: { email: string }) => user.email === 'worker-b@tempopoint.test',
    ).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('organization administration', () => {
  it('keeps ADMIN operations within the authenticated company and rejects manipulated posts', async () => {
    const forbidden = await app.inject({
      url: `/api/admin/users/${workerBId}`,
      headers: { cookie: adminA.sessionCookie },
    });
    expect(forbidden.statusCode).toBe(404);
    const injectedCompany = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: {
        cookie: `${adminA.sessionCookie}; ${adminA.cookie}`,
        'x-csrf-token': adminA.token,
      },
      payload: {
        companyId: '00000000-0000-0000-0000-000000000000',
        email: 'injected@tempopoint.test',
        password: 'A-very-long-password',
        firstName: 'Injected',
        lastName: 'Tenant',
        role: 'WORKER',
      },
    });
    expect(injectedCompany.statusCode).toBe(400);
    const usersB = await app.inject({
      url: '/api/admin/users',
      headers: { cookie: adminB.sessionCookie },
    });
    expect(
      usersB
        .json()
        .data.users.some(
          (user: { email: string }) => user.email === 'admin-a@tempopoint.test',
        ),
    ).toBe(false);
  });

  it('creates teams, assigns a manager, and rejects a foreign user ID', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/teams',
      headers: {
        cookie: `${adminA.sessionCookie}; ${adminA.cookie}`,
        'x-csrf-token': adminA.token,
      },
      payload: {
        name: 'ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°quipe intÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gration',
        description: 'VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rification JALON 4',
      },
    });
    expect(created.statusCode).toBe(201);
    const teamId = created.json().data.team.id as string;
    const manager = await app.inject({
      method: 'POST',
      url: `/api/admin/teams/${teamId}/members`,
      headers: {
        cookie: `${adminA.sessionCookie}; ${adminA.cookie}`,
        'x-csrf-token': adminA.token,
      },
      payload: { userId: managerAId, isManager: true },
    });
    expect(manager.statusCode).toBe(201);
    expect(manager.json().data.member.isManager).toBe(true);
    const foreign = await app.inject({
      method: 'POST',
      url: `/api/admin/teams/${teamId}/members`,
      headers: {
        cookie: `${adminA.sessionCookie}; ${adminA.cookie}`,
        'x-csrf-token': adminA.token,
      },
      payload: { userId: workerBId, isManager: false },
    });
    expect(foreign.statusCode).toBe(404);
  });

  it('lets the separate platform account create and deactivate a company', async () => {
    const protection = await csrf();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/platform-auth/login',
      headers: { cookie: protection.cookie, 'x-csrf-token': protection.token },
      payload: { email: 'platform-admin@tempopoint.test', password },
    });
    expect(loginResponse.statusCode).toBe(200);
    const platformCookie = firstCookie(loginResponse.headers['set-cookie']);
    const suffix = Date.now();
    const created = await app.inject({
      method: 'POST',
      url: '/api/platform/companies',
      headers: {
        cookie: `${platformCookie}; ${protection.cookie}`,
        'x-csrf-token': protection.token,
      },
      payload: {
        name: `Company ${suffix}`,
        slug: `company-${suffix}`,
        timezone: 'Europe/Brussels',
        locale: 'fr-BE',
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.company.id as string;
    const disabled = await app.inject({
      method: 'POST',
      url: `/api/platform/companies/${id}/deactivate`,
      headers: {
        cookie: `${platformCookie}; ${protection.cookie}`,
        'x-csrf-token': protection.token,
      },
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().data.company.active).toBe(false);
  });
});
