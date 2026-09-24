import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../../backend/src/app.js';
import { parseEnvironment } from '../../backend/src/config.js';
const url = process.env.DATABASE_URL!,
  password = process.env.DEVELOPMENT_SEED_PASSWORD!,
  prisma = new PrismaClient({ datasources: { db: { url } } }),
  app = await buildApp(
    parseEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: url,
      SESSION_SECRET: 'test-session-secret-with-at-least-thirty-two-characters',
      LOGIN_RATE_LIMIT_MAX: '20',
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
    }),
    { prisma },
  );
const ck = (v: string | string[] | undefined) => {
  const x = Array.isArray(v) ? v[0] : v;
  if (!x) throw Error('cookie');
  return x.split(';')[0]!;
};
async function login(slug: string, email: string) {
  const c = await app.inject('/api/auth/csrf');
  const csrf = ck(c.headers['set-cookie']),
    token = c.json().data.csrfToken;
  const r = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { cookie: csrf, 'x-csrf-token': token },
    payload: { companySlug: slug, email, password },
  });
  expect(r.statusCode).toBe(200);
  return { session: ck(r.headers['set-cookie']), csrf, token };
}
const h = (x: Awaited<ReturnType<typeof login>>) => ({
  cookie: `${x.session}; ${x.csrf}`,
  'x-csrf-token': x.token,
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
describe('work entries and approvals', () =>
  it('calculates server minutes, submits and approves only in its tenant', async () => {
    const worker = await login('secret-company-a', 'worker-a@tempopoint.test'),
      admin = await login('secret-company-a', 'admin-a@tempopoint.test'),
      other = await login('secret-company-b', 'admin-b@tempopoint.test');
    const created = await app.inject({
      method: 'POST',
      url: '/api/work-entries',
      headers: h(worker),
      payload: {
        date: '2026-09-21',
        startTime: '2026-09-21T08:00:00.000Z',
        endTime: '2026-09-21T16:30:00.000Z',
        breakMinutes: 30,
        note: 'Jalon 6',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.entry.workedMinutes).toBe(480);
    const id = created.json().data.entry.id;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/work-entries/${id}/submit`,
          headers: h(worker),
        })
      ).json().data.entry.status,
    ).toBe('SUBMITTED');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/work-entries/${id}/approve`,
          headers: h(other),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/work-entries/${id}/approve`,
          headers: h(admin),
        })
      ).json().data.entry.status,
    ).toBe('APPROVED');
  }));
