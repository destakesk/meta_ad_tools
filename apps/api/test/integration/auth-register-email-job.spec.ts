import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectErr, expectOk } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
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

describe('register → enqueues verification email', () => {
  test('writes user, returns userId, dumps mail with token', async () => {
    const email = `register-${Date.now().toString()}@example.test`;
    const res = await api.post<{ userId: string; emailVerificationRequired: true }>(
      '/api/auth/register',
      { email, password: 'Hg7xVk9fLm2pQy', fullName: 'Reg User' },
    );
    const data = expectOk(res);
    expect(data.userId).toBeTruthy();
    expect(data.emailVerificationRequired).toBe(true);

    const mail = await waitForMail(email);
    expect(mail.template).toBe('verify-email');
    expect(mail.token).toBeTruthy();
  });

  test('rejects pre-verification login with email_not_verified', async () => {
    const email = `prev-${Date.now().toString()}@example.test`;
    expectOk(
      await api.post('/api/auth/register', {
        email,
        password: 'Hg7xVk9fLm2pQy',
        fullName: 'Pre Verify',
      }),
    );

    const res = await api.post<unknown>('/api/auth/login', {
      email,
      password: 'Hg7xVk9fLm2pQy',
    });
    expectErr(res, 'email_not_verified');
  });
});
