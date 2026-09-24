import { afterEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { buildApp } from '../../backend/src/app.js';
import { parseEnvironment } from '../../backend/src/config.js';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function createApp(production = false) {
  const app = await buildApp(
    parseEnvironment({
      NODE_ENV: production ? 'production' : 'test',
      LOG_LEVEL: 'silent',
    }),
  );
  apps.push(app);
  return app;
}
describe('foundation', () => {
  it('responds with a minimal health contract', async () => {
    const app = await createApp();
    const response = await app.inject('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { status: 'ok', version: '0.1.0' },
    });
  });
  it('serves built HTML, deep links and real assets', async () => {
    const app = await createApp(true);
    const html = await readFile(
      new URL('../../frontend/dist/index.html', import.meta.url),
      'utf8',
    );
    for (const url of ['/', '/nested/page']) {
      const response = await app.inject({
        url,
        headers: { accept: 'text/html' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(html);
    }
    const asset = html.match(/src="([^"]+\.js)"/)?.[1];
    expect(asset).toBeTruthy();
    const response = await app.inject(asset!);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('javascript');
    expect(response.body).not.toContain('<!doctype html>');
  });
  it.each([
    '/api',
    '/api/missing',
    '/assets/missing.js',
    '/missing.css',
    '/.env',
    '/package.json',
  ])('does not use HTML fallback for %s', async (url) => {
    const app = await createApp(true);
    const response = await app.inject({
      url,
      headers: { accept: 'text/html' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
  it('does not use HTML fallback for mutations or JSON requests', async () => {
    const app = await createApp(true);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/nested',
          headers: { accept: 'text/html' },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          url: '/nested',
          headers: { accept: 'application/json' },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('fails startup when the production build is missing', async () => {
    await expect(
      buildApp(
        parseEnvironment({ NODE_ENV: 'production', LOG_LEVEL: 'silent' }),
        { staticRoot: 'missing-frontend-build' },
      ),
    ).rejects.toThrow();
  });
  it('hides internal errors', async () => {
    const app = await createApp();
    app.get('/api/test-error', () => {
      throw new Error('PRIVATE_INTERNAL_DETAIL');
    });
    const response = await app.inject('/api/test-error');
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('PRIVATE_INTERNAL_DETAIL');
  });
});
describe('environment validation', () => {
  it('defaults to port 3000 and distrusts forwarded headers', () => {
    expect(parseEnvironment({})).toMatchObject({
      PORT: 3000,
      TRUST_PROXY: false,
    });
  });
  it.each(['0', '-1', '65536', 'abc', '3.5', ''])(
    'rejects invalid port %s',
    (PORT) => {
      expect(() => parseEnvironment({ PORT })).toThrow('PORT');
    },
  );
  it('accepts explicit proxy networks', () => {
    expect(
      parseEnvironment({ TRUST_PROXY: '127.0.0.1,10.0.0.0/8,::1' }).TRUST_PROXY,
    ).toEqual(['127.0.0.1', '10.0.0.0/8', '::1']);
  });
  it.each(['true', 'garbage', '10.0.0.0/99', ''])(
    'rejects unsafe proxy configuration %s',
    (TRUST_PROXY) => {
      expect(() => parseEnvironment({ TRUST_PROXY })).toThrow('TRUST_PROXY');
    },
  );
});
