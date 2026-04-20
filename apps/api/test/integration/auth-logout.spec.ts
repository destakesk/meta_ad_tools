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

describe('logout blacklists the access JTI', () => {
  test('access token rejected immediately after logout', async () => {
    const user = await registerVerifyAndLogin(app);

    expectOk(
      await api.post('/api/auth/logout', undefined, {
        auth: user.accessToken,
        cookie: user.refreshCookie,
      }),
    );

    const me = await api.get<unknown>('/api/users/me', { auth: user.accessToken });
    expect(me.body.success).toBe(false);
  });
});
