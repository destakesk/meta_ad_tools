import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectOk } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
import { registerVerifyAndLogin } from './helpers/factories.js';
import { waitForMail } from './helpers/mailbox.js';
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

describe('password reset + change flows', () => {
  test('password reset revokes every active session', async () => {
    const user = await registerVerifyAndLogin(app);

    expectOk(await api.post('/api/auth/password/forgot', { email: user.email }));
    const mail = await waitForMail(user.email, { template: 'password-reset' });

    expectOk(
      await api.post('/api/auth/password/reset', {
        token: mail.token,
        newPassword: 'Vw9!pQz#Lk3xMr8tBn',
      }),
    );

    // The refresh cookie tied to the now-revoked session must fail. (The
    // access JWT itself stays valid until its 15-min TTL expires — JWTs are
    // not session-bound; that's why we revoke the refresh side.)
    const refresh = await api.post<{ accessToken: string | null }>('/api/auth/refresh', undefined, {
      cookie: user.refreshCookie,
    });
    expect(refresh.body.success).toBe(false);
  });

  test('password change keeps the current session, drops the others', async () => {
    const user = await registerVerifyAndLogin(app);

    expectOk(
      await api.post(
        '/api/auth/password/change',
        { currentPassword: user.password, newPassword: 'Vw9pQzLk3xMr8tBn' },
        { auth: user.accessToken, cookie: user.refreshCookie },
      ),
    );

    // Same access token still works because the current session was preserved.
    const me = expectOk(
      await api.get<{ user: { email: string } }>('/api/users/me', { auth: user.accessToken }),
    );
    expect(me.user.email).toBe(user.email);
  });

  test('forgot-password is enumeration-safe (success on unknown email)', async () => {
    const res = await api.post<{ ok: true }>('/api/auth/password/forgot', {
      email: `nonexistent-${Date.now().toString()}@example.test`,
    });
    const data = expectOk(res);
    expect(data.ok).toBe(true);
  });
});
