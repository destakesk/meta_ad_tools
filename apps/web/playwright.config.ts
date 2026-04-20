import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT.toString()}`;
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/**
 * Playwright config for module 02 e2e suite.
 *
 * Boots both web (port 3000) and api (port 3001). The api is started with
 * `RESEND_API_KEY=''` and `MAIL_DUMP_DIR=tests/e2e/.mailbox` so the helpers
 * under `tests/e2e/helpers/mailbox` can read verify / reset / invitation
 * tokens from the on-disk dumps the EmailProcessor writes.
 *
 *   pnpm --filter @metaflow/web test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] !== undefined ? 2 : 0,
  workers: 1,
  reporter: process.env['CI'] !== undefined ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: { 'X-Requested-With': 'metaflow-web' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @metaflow/api dev',
      url: `${API_URL}/health/ready`,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
      env: {
        RESEND_API_KEY: '',
        MAIL_DUMP_DIR:
          process.env['MAIL_DUMP_DIR'] ??
          new URL('./tests/e2e/.mailbox/', `file://${process.cwd()}/`).pathname,
      },
    },
    {
      command: 'pnpm --filter @metaflow/web dev',
      url: BASE_URL,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
});
