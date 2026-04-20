import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectOk, getRefreshCookie } from './helpers/api.js';
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

describe('refresh rotation + theft detection', () => {
  test('rotates the refresh cookie and returns a fresh access token', async () => {
    const user = await registerVerifyAndLogin(app);

    const res = await api.post<{ accessToken: string }>('/api/auth/refresh', undefined, {
      cookie: user.refreshCookie,
    });
    const data = expectOk(res);
    expect(data.accessToken).toBeTruthy();
    expect(data.accessToken).not.toBe(user.accessToken);

    const newCookie = getRefreshCookie(res.headers);
    expect(newCookie).toBeTruthy();
    expect(newCookie).not.toBe(user.refreshCookie);
  });

  test('replaying an old refresh cookie revokes every active session', async () => {
    const user = await registerVerifyAndLogin(app);

    const first = await api.post<{ accessToken: string }>('/api/auth/refresh', undefined, {
      cookie: user.refreshCookie,
    });
    expectOk(first);

    // Replay the original (now stale) cookie — auth service should detect
    // theft, revoke everything, return an error envelope.
    const replay = await api.post<unknown>('/api/auth/refresh', undefined, {
      cookie: user.refreshCookie,
    });
    expect(replay.body.success).toBe(false);

    // The cookie returned by the legitimate refresh is now also revoked,
    // because theft detection nukes every session for the user.
    const newCookie = getRefreshCookie(first.headers) ?? '';
    const followUp = await api.post<{ accessToken: string | null }>(
      '/api/auth/refresh',
      undefined,
      { cookie: newCookie },
    );
    expect(followUp.body.success).toBe(false);
  });
});
