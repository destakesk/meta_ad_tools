import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedRedisContainer } from '@testcontainers/redis';

/**
 * Vitest globalSetup — runs once before any test file and tears down after
 * the suite. We keep ONE postgres + ONE redis instance for the whole run;
 * `per-test-setup.ts` truncates volatile tables between specs.
 *
 * The mail dump dir is also scoped per-run so EmailProcessor writes here
 * (the verify/reset/invitation token can be read by the mailbox helper).
 */
let pg: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;
let mailDir: string | undefined;

const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  PORT: '0',
  APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3001',
  RESEND_API_KEY: '',
  EMAIL_FROM: 'noreply@metaflow.test',
  EMAIL_VERIFY_URL_BASE: 'http://localhost:3000/verify-email',
  PASSWORD_RESET_URL_BASE: 'http://localhost:3000/reset-password',
  INVITATION_URL_BASE: 'http://localhost:3000/invite/accept',
  JWT_SECRET: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  MFA_TOKEN_SECRET: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA=',
  MFA_ISSUER: 'metaflow-test',
  MFA_DISABLE_ALLOWED: 'true',
  ENCRYPTION_KEY: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCA=',
  COOKIE_DOMAIN: 'localhost',
  COOKIE_SECURE: 'false',
  CORS_ORIGINS: 'http://localhost:3000',
  THROTTLE_TTL: '60',
  THROTTLE_LIMIT: '1000',
};

export async function setup(): Promise<void> {
  pg = await new PostgreSqlContainer('postgres:16')
    .withDatabase('metaflow_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .withReuse()
    .start();

  redis = await new RedisContainer('redis:7').withReuse().start();

  mailDir = mkdtempSync(join(tmpdir(), 'metaflow-mail-'));

  const databaseUrl = pg.getConnectionUri();
  const redisUrl = redis.getConnectionUrl();

  Object.assign(process.env, TEST_ENV, {
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    REDIS_PREFIX: `test:${Date.now().toString()}:`,
    MAIL_DUMP_DIR: mailDir,
    __TEST_MAIL_DIR: mailDir,
  });

  // Apply schema. `migrate deploy` is idempotent with a fresh DB.
  execSync('pnpm --filter @metaflow/database db:migrate:deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  execSync('pnpm --filter @metaflow/database db:seed', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export async function teardown(): Promise<void> {
  if (mailDir) {
    rmSync(mailDir, { recursive: true, force: true });
  }
  await pg?.stop();
  await redis?.stop();
}
