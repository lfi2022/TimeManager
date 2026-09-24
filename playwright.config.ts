import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node backend/dist/server.js',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '3000',
      LOG_LEVEL: 'silent',
    },
  },
});
