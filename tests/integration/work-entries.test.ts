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
      LOGIN_RATE_LIMIT_MAX: '100',
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
    const admin = await login('secret-company-a', 'admin-a@tempopoint.test'),
      other = await login('secret-company-b', 'admin-b@tempopoint.test');
    const created = await app.inject({
      method: 'POST',
      url: '/api/work-entries',
      headers: h(admin),
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
          headers: h(admin),
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

it('limits a manager to members of managed teams', async () => {
  const admin = await login('secret-company-a', 'admin-a@tempopoint.test'),
    manager = await login('secret-company-a', 'manager-a@tempopoint.test');
  const users = (
    await app.inject({
      url: '/api/admin/users',
      headers: { cookie: admin.session },
    })
  ).json().data.users;
  const managerId = users.find(
      (x: { email: string }) => x.email === 'manager-a@tempopoint.test',
    ).id,
    workerId = users.find(
      (x: { email: string }) => x.email === 'worker-a@tempopoint.test',
    ).id;
  const team = (
    await app.inject({
      method: 'POST',
      url: '/api/admin/teams',
      headers: h(admin),
      payload: { name: `Review ${Date.now()}` },
    })
  ).json().data.team;
  for (const userId of [managerId, workerId])
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/admin/teams/${team.id}/members`,
          headers: h(admin),
          payload: { userId, isManager: userId === managerId },
        })
      ).statusCode,
    ).toBe(201);
  const e = await app.inject({
    method: 'POST',
    url: '/api/work-entries',
    headers: h(admin),
    payload: {
      userId: workerId,
      date: '2026-09-22',
      startTime: '2026-09-22T08:00:00.000Z',
      endTime: '2026-09-22T12:00:00.000Z',
      breakMinutes: 0,
    },
  });
  const id = e.json().data.entry.id;
  await app.inject({
    method: 'POST',
    url: `/api/work-entries/${id}/submit`,
    headers: h(admin),
  });
  expect(
    (
      await app.inject({
        method: 'POST',
        url: `/api/work-entries/${id}/approve`,
        headers: h(manager),
      })
    ).json().data.entry.status,
  ).toBe('APPROVED');
});

it('prevents a second active clock and converts stop to a work entry', async () => {
  const admin = await login('secret-company-a', 'admin-a@tempopoint.test');
  const started = await app.inject({
    method: 'POST',
    url: '/api/clock/start',
    headers: h(admin),
    payload: {},
  });
  expect(started.statusCode).toBe(201);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/clock/start',
        headers: h(admin),
        payload: {},
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        url: '/api/clock/status',
        headers: { cookie: admin.session },
      })
    ).json().data.session,
  ).not.toBeNull();
  const stopped = await app.inject({
    method: 'POST',
    url: '/api/clock/stop',
    headers: h(admin),
  });
  expect(stopped.statusCode).toBe(200);
  expect(stopped.json().data.entry.source).toBe('CLOCK');
});
