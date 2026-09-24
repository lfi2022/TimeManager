import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(root, 'docker-compose.test.yml');
const project = 'tempopoint-test-' + process.pid;
const migratorPassword = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const seedPassword = randomBytes(24).toString('base64url');
const compose = process.platform === 'win32' ? 'docker.exe' : 'docker';
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error('pnpm execution path is unavailable.');
const composeEnvironment = {
  ...process.env,
  POSTGRES_PASSWORD: migratorPassword,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: options.env ?? process.env,
    windowsHide: true,
    timeout: options.timeout ?? 60000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error((result.stderr || result.stdout).trim());
  return result.stdout.trim();
}

function dockerCompose(...args) {
  return run(
    compose,
    ['compose', '--project-name', project, '--file', composeFile, ...args],
    { env: composeEnvironment },
  );
}

try {
  dockerCompose('up', '--detach', '--wait');
  const address = dockerCompose('port', 'database', '5432');
  const port = address.slice(address.lastIndexOf(':') + 1);
  const migratorUrl =
    'postgresql://tempopoint_migrator:' +
    migratorPassword +
    '@127.0.0.1:' +
    port +
    '/tempopoint_test?schema=public';
  const appUrl =
    'postgresql://tempopoint_app:' +
    appPassword +
    '@127.0.0.1:' +
    port +
    '/tempopoint_test?schema=public';
  const testEnvironment = {
    ...process.env,
    DATABASE_URL: migratorUrl,
    DEVELOPMENT_SEED_PASSWORD: seedPassword,
  };

  run(
    process.execPath,
    [
      pnpmCli,
      '--filter',
      '@lfinfo/backend',
      'exec',
      'prisma',
      'migrate',
      'deploy',
      '--schema',
      'prisma/schema.prisma',
    ],
    { env: testEnvironment },
  );
  dockerCompose(
    'exec',
    '-T',
    'database',
    'psql',
    '-U',
    'tempopoint_migrator',
    '-d',
    'tempopoint_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    "CREATE ROLE tempopoint_app LOGIN PASSWORD '" +
      appPassword +
      "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; GRANT USAGE ON SCHEMA public TO tempopoint_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tempopoint_app;",
  );
  run(
    process.execPath,
    [
      pnpmCli,
      '--filter',
      '@lfinfo/backend',
      'exec',
      'prisma',
      'db',
      'seed',
      '--schema',
      'prisma/schema.prisma',
    ],
    { env: testEnvironment },
  );
  run(
    process.execPath,
    [
      pnpmCli,
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.integration.config.ts',
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: appUrl,
        DATABASE_MIGRATOR_URL: migratorUrl,
        DEVELOPMENT_SEED_PASSWORD: seedPassword,
      },
    },
  );
  console.log(
    'PASS: fresh PostgreSQL migration, seed, RLS, and two-way tenant isolation.',
  );
} finally {
  try {
    dockerCompose('down', '--volumes', '--remove-orphans');
  } catch {
    /* Keep the original error. */
  }
}
