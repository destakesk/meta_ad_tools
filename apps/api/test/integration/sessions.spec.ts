import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectOk } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
import { registerVerifyAndLogin } from './helpers/factories.js';
import { disconnectRedis } from './helpers/redis.js';

import type { INestApplication } from '@nestjs/common';

let app: INestApplication;
let api: ApiClient;

beforeAll(async () => {
  app = await buildTestApp();
  api = new ApiClient(app);
});

afterAll(async () => {
  await app.close();
  await disconnectDb();
  await disconnectRedis();
});

describe('session listing + revocation', () => {
  test('listing returns the active session marked as current', async () => {
    const user = await registerVerifyAndLogin(app);
    const sessions = expectOk(
      await api.get<{ sessions: { isCurrent: boolean }[] }>('/api/auth/sessions', {
        auth: user.accessToken,
      }),
    );
    expect(sessions.sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.sessions.filter((s) => s.isCurrent)).toHaveLength(1);
  });

  test('DELETE on current session returns the cannot_revoke_current envelope', async () => {
    const user = await registerVerifyAndLogin(app);
    const list = expectOk(
      await api.get<{ sessions: { id: string; isCurrent: boolean }[] }>('/api/auth/sessions', {
        auth: user.accessToken,
      }),
    );
    const current = list.sessions.find((s) => s.isCurrent);
    expect(current).toBeTruthy();
    const res = expectOk(
      await api.del<{ ok: boolean; error?: { code: string } }>(
        `/api/auth/sessions/${current?.id ?? ''}`,
        { auth: user.accessToken },
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('cannot_revoke_current');
  });
});
