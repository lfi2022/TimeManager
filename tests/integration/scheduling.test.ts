import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../../backend/src/app.js';
import { parseEnvironment } from '../../backend/src/config.js';
const url = process.env.DATABASE_URL!;
const password = process.env.DEVELOPMENT_SEED_PASSWORD!;
const prisma = new PrismaClient({ datasources: { db: { url } } });
const app = await buildApp(
  parseEnvironment({
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    DATABASE_URL: url,
    SESSION_SECRET: 'test-session-secret-with-at-least-thirty-two-characters',
    LOGIN_RATE_LIMIT_MAX: '20',
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
  }),
  { prisma },
);
function cookie(v: string | string[] | undefined) {
  const c = Array.isArray(v) ? v[0] : v;
  if (!c) throw new Error('cookie');
  return c.split(';')[0]!;
}
async function login(slug: string, email: string) {
  const c = await app.inject('/api/auth/csrf');
  const csrf = cookie(c.headers['set-cookie']);
  const token = c.json().data.csrfToken as string;
  const r = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { cookie: csrf, 'x-csrf-token': token },
    payload: { companySlug: slug, email, password },
  });
  expect(r.statusCode).toBe(200);
  return { session: cookie(r.headers['set-cookie']), csrf, token };
}
let a: Awaited<ReturnType<typeof login>>,
  b: Awaited<ReturnType<typeof login>>,
  workerA: string;
beforeAll(async () => {
  a = await login('secret-company-a', 'admin-a@tempopoint.test');
  b = await login('secret-company-b', 'admin-b@tempopoint.test');
  const users = await app.inject({
    url: '/api/admin/users',
    headers: { cookie: a.session },
  });
  workerA = users
    .json()
    .data.users.find(
      (u: { email: string }) => u.email === 'worker-a@tempopoint.test',
    ).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
const headers = (x: Awaited<ReturnType<typeof login>>) => ({
  cookie: `${x.session}; ${x.csrf}`,
  'x-csrf-token': x.token,
});
describe('worksites and schedules', () => {
  it('isolates worksites and archives them', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/worksites',
      headers: headers(a),
      payload: { name: 'Chantier A', code: 'A-01' },
    });
    expect(r.statusCode).toBe(201);
    const id = r.json().data.worksite.id;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/admin/worksites/${id}/archive`,
          headers: headers(b),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/admin/worksites/${id}/archive`,
          headers: headers(a),
        })
      ).json().data.worksite.active,
    ).toBe(false);
  });
  it('calculates expected minutes and rejects a foreign schedule assignment', async () => {
    const payload = {
      name: '37h30',
      days: [
        {
          dayOfWeek: 0,
          expectedMinutes: 450,
          defaultStartTime: '08:00',
          defaultEndTime: '16:30',
          defaultBreakMinutes: 30,
        },
      ],
    };
    const sa = await app.inject({
      method: 'POST',
      url: '/api/admin/schedules',
      headers: headers(a),
      payload,
    });
    const sb = await app.inject({
      method: 'POST',
      url: '/api/admin/schedules',
      headers: headers(b),
      payload: { ...payload, name: 'B' },
    });
    expect(sa.statusCode, sa.body).toBe(201);
    const assignment = await app.inject({
      method: 'POST',
      url: '/api/admin/schedule-assignments',
      headers: headers(a),
      payload: {
        userId: workerA,
        scheduleId: sa.json().data.schedule.id,
        validFrom: '2026-09-21',
      },
    });
    expect(assignment.statusCode).toBe(201);
    const expected = await app.inject({
      url: `/api/admin/users/${workerA}/expected-minutes?date=2026-09-21`,
      headers: { cookie: a.session },
    });
    expect(expected.json().data.minutes).toBe(450);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/admin/schedule-assignments',
          headers: headers(a),
          payload: {
            userId: workerA,
            scheduleId: sb.json().data.schedule.id,
            validFrom: '2026-09-21',
          },
        })
      ).statusCode,
    ).toBe(404);
  });
});
