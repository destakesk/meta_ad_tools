import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectErr, expectOk } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
import { registerAndVerify } from './helpers/factories.js';
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

describe('login lockout after repeated wrong-password attempts', () => {
  test('6 failures lock the account; the next attempt is rejected even with the right password', async () => {
    const user = await registerAndVerify(app);

    // Six failures push the failed-login counter past the LOCKOUT_MAX_ATTEMPTS
    // threshold (count > 5 → limited). The implementation sets lockedUntil on
    // the failure that crosses the threshold.
    for (let i = 0; i < 6; i += 1) {
      const res = await api.post<unknown>('/api/auth/login', {
        email: user.email,
        password: 'Hg7xVk9fLm2pQyWRONG',
      });
      expect(res.body.success).toBe(false);
    }

    const locked = await api.post<unknown>('/api/auth/login', {
      email: user.email,
      password: user.password,
    });
    const err = expectErr(locked);
    expect(err.message === 'account_locked' || err.code === 'forbidden').toBe(true);
  });

  test('first attempt with the right password just works', async () => {
    const user = await registerAndVerify(app);
    const res = await api.post<{ step: string }>('/api/auth/login', {
      email: user.email,
      password: user.password,
    });
    const data = expectOk(res);
    expect(['success', 'mfa_setup_required', 'mfa_challenge']).toContain(data.step);
  });
});
