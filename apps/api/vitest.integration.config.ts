import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against real Postgres + Redis containers spun up by
 * testcontainers in `globalSetup`. They are kept out of the default `pnpm
 * test` run because container boot is slow (≈20s) and requires Docker.
 *
 *   pnpm --filter @metaflow/api test:integration
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/integration/per-test-setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallel: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
