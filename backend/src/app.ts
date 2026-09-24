import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import type { HealthResponse } from '@lfinfo/shared';
import type { Environment } from './config.js';

export async function buildApp(
  config: Environment,
  options: { staticRoot?: string } = {},
) {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
          },
  });
  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    data: { status: 'ok', version: '0.1.0' },
  }));
  if (config.NODE_ENV === 'production') {
    const root =
      options.staticRoot ??
      fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
    await access(join(root, 'index.html'));
    await app.register(fastifyStatic, {
      root,
      prefix: '/',
      index: 'index.html',
      dotfiles: 'ignore',
    });
  }
  app.setNotFoundHandler((request, reply) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    const isAsset =
      pathname === '/assets' ||
      pathname.startsWith('/assets/') ||
      extname(pathname) !== '' ||
      pathname.split('/').some((part) => part.startsWith('.'));
    const isNavigation =
      (request.method === 'GET' || request.method === 'HEAD') &&
      request.headers.accept?.includes('text/html');
    if (
      config.NODE_ENV === 'production' &&
      !isApi &&
      !isAsset &&
      isNavigation
    ) {
      return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
    }
    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' },
    });
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Request failed');
    const status =
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400 &&
      error.statusCode < 500
        ? error.statusCode
        : 500;
    return reply.code(status).send({
      error: {
        code: status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
        message: status === 500 ? 'Erreur interne.' : 'Requête invalide.',
      },
    });
  });
  return app;
}
