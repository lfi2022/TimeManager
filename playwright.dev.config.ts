import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'development', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173/api/health',
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: '3001',
      LOG_LEVEL: 'silent',
    },
  },
});
