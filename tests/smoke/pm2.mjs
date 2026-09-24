import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const cli = require.resolve('pm2/bin/pm2');
const pm2Home = resolve('test-results', 'pm2-' + process.pid);
mkdirSync(pm2Home, { recursive: true });
const env = {
  ...process.env,
  PM2_HOME: pm2Home,
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
};
function pm2(...args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
try {
  pm2('start', 'ecosystem.config.cjs');
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/health', {
        signal: AbortSignal.timeout(1000),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        data: { status: 'ok', version: '0.1.0' },
      });
      healthy = true;
      break;
    } catch {
      await setTimeout(250);
    }
  }
  assert.ok(healthy, 'PM2 health endpoint did not become ready');
  const processes = JSON.parse(pm2('jlist'));
  assert.equal(processes.length, 1);
  assert.equal(processes[0].name, 'tempopoint');
  assert.equal(processes[0].pm2_env.status, 'online');
  assert.equal(processes[0].pm2_env.exec_mode, 'fork_mode');
  assert.equal(processes[0].pm2_env.NODE_ENV, 'production');
  const response = await fetch('http://127.0.0.1:3000/', {
    headers: { Accept: 'text/html' },
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>TempoPoint<\/title>/);
  console.log(
    'PASS: PM2 runs one production Node process serving React and /api/health on port 3000.',
  );
} finally {
  pm2('kill');
}
