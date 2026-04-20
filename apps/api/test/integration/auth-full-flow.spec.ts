import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectOk, getRefreshCookie } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
import { waitForMail } from './helpers/mailbox.js';
import { disconnectRedis } from './helpers/redis.js';
import { totp } from './helpers/totp.js';

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

describe('full register → verify → mfa-setup → me round-trip', () => {
  test('threads access token + refresh cookie + me lookup', async () => {
    const email = `flow-${Date.now().toString()}@example.test`;
    const password = 'Hg7xVk9fLm2pQy';

    expectOk(await api.post('/api/auth/register', { email, password, fullName: 'Flow User' }));
    const verifyMail = await waitForMail(email);
    expectOk(await api.post('/api/auth/email/verify', { token: verifyMail.token }));

    const loginRes = await api.post<{ step: string; mfaSetupToken: string }>('/api/auth/login', {
      email,
      password,
    });
    const login = expectOk(loginRes);
    expect(login.step).toBe('mfa_setup_required');

    const init = expectOk(
      await api.get<{ secret: string; qrCodeDataUrl: string }>(
        `/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(login.mfaSetupToken)}`,
      ),
    );
    expect(init.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const setupRes = await api.post<{ accessToken: string; backupCodes: string[] }>(
      '/api/auth/mfa/setup',
      { mfaSetupToken: login.mfaSetupToken, totpCode: totp(init.secret) },
    );
    const setup = expectOk(setupRes);
    expect(setup.backupCodes).toHaveLength(10);
    expect(getRefreshCookie(setupRes.headers)).toBeTruthy();

    const me = expectOk(
      await api.get<{ user: { email: string }; mfaEnabled: boolean }>('/api/users/me', {
        auth: setup.accessToken,
      }),
    );
    expect(me.user.email).toBe(email);
    expect(me.mfaEnabled).toBe(true);
  });
});
