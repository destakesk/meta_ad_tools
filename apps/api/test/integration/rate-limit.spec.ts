import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
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

describe('throttling — Redis-backed @Throttle decorator hits 429', () => {
  test('forgot-password ratelimit (3/hour) trips on the 4th call', async () => {
    const email = `rate-${Date.now().toString()}@example.test`;
    let trippedAt = 0;
    for (let i = 1; i <= 5; i += 1) {
      const res = await api.post<unknown>('/api/auth/password/forgot', { email });
      if (res.status === 429) {
        trippedAt = i;
        break;
      }
    }
    expect(trippedAt).toBeGreaterThanOrEqual(4);
  });

  test('login ratelimit (10/15min) eventually 429s on hot loop', async () => {
    const email = `loginrate-${Date.now().toString()}@example.test`;
    let trippedAt = 0;
    for (let i = 1; i <= 15; i += 1) {
      const res = await api.post<unknown>('/api/auth/login', { email, password: 'whatever' });
      if (res.status === 429) {
        trippedAt = i;
        break;
      }
    }
    expect(trippedAt).toBeGreaterThanOrEqual(11);
  });
});
