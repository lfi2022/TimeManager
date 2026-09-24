import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';
import { buildApp } from './app.js';
import { parseEnvironment } from './config.js';

loadDotEnv({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});
try {
  const config = parseEnvironment(process.env);
  const app = await buildApp(config);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().catch(() => {
        process.exitCode = 1;
      });
    });
  }
  await app.listen({ host: config.HOST, port: config.PORT });
  if (process.send) process.send('ready');
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Server startup failed',
  );
  process.exitCode = 1;
}
