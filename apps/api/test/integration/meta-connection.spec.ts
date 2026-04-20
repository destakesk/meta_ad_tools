import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectErr, expectOk } from './helpers/api.js';
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

interface InitResponse {
  authorizeUrl: string;
  state: string;
  expiresInSeconds: number;
}

interface CallbackResponse {
  connection: { id: string; metaUserId: string; status: string };
  workspaceSlug: string;
}

interface ConnectionResponse {
  connection: { id: string; status: string; lastRotatedAt: string | null } | null;
}

async function bootstrapWorkspace(): Promise<{
  accessToken: string;
  workspaceSlug: string;
  workspaceId: string;
}> {
  const owner = await registerVerifyAndLogin(app);
  const org = expectOk(
    await api.get<{ organization: { id: string }; workspaces: { id: string; slug: string }[] }>(
      '/api/organizations/current',
      { auth: owner.accessToken },
    ),
  );
  const ws = org.workspaces[0];
  if (!ws) throw new Error('register flow did not seed a workspace');
  return { accessToken: owner.accessToken, workspaceSlug: ws.slug, workspaceId: ws.id };
}

async function completeMockOAuth(
  accessToken: string,
  workspaceSlug: string,
): Promise<CallbackResponse> {
  const init = expectOk(
    await api.post<InitResponse>(`/api/workspaces/${workspaceSlug}/meta/connect/init`, undefined, {
      auth: accessToken,
    }),
  );

  // Mock provider's authorize URL embeds the fake code + the same state.
  const callbackUrl = new URL(init.authorizeUrl);
  const code = callbackUrl.searchParams.get('code') ?? '';
  const state = callbackUrl.searchParams.get('state') ?? '';
  return expectOk(
    await api.post<CallbackResponse>(
      '/api/meta/connect/callback',
      { code, state },
      { auth: accessToken },
    ),
  );
}

describe('Meta connection — full lifecycle against the mock provider', () => {
  test('init → callback persists an ACTIVE connection visible via GET /meta', async () => {
    const ctx = await bootstrapWorkspace();
    const cb = await completeMockOAuth(ctx.accessToken, ctx.workspaceSlug);
    expect(cb.workspaceSlug).toBe(ctx.workspaceSlug);
    expect(cb.connection.status).toBe('ACTIVE');

    const status = expectOk(
      await api.get<ConnectionResponse>(`/api/workspaces/${ctx.workspaceSlug}/meta`, {
        auth: ctx.accessToken,
      }),
    );
    expect(status.connection?.id).toBe(cb.connection.id);
    expect(status.connection?.status).toBe('ACTIVE');
  });

  test('callback with an unknown state returns oauth_state_invalid_or_expired', async () => {
    const ctx = await bootstrapWorkspace();
    const res = await api.post<unknown>(
      '/api/meta/connect/callback',
      { code: 'whatever', state: 'never-issued' },
      { auth: ctx.accessToken },
    );
    expectErr(res, 'oauth_state_invalid_or_expired');
  });

  test('rotate bumps lastRotatedAt and re-encrypts the access token', async () => {
    const ctx = await bootstrapWorkspace();
    const cb = await completeMockOAuth(ctx.accessToken, ctx.workspaceSlug);

    const before = expectOk(
      await api.get<ConnectionResponse>(`/api/workspaces/${ctx.workspaceSlug}/meta`, {
        auth: ctx.accessToken,
      }),
    );
    expect(before.connection?.lastRotatedAt).toBeNull();

    expectOk(
      await api.post<ConnectionResponse>(
        `/api/workspaces/${ctx.workspaceSlug}/meta/${cb.connection.id}/rotate`,
        undefined,
        { auth: ctx.accessToken },
      ),
    );

    const after = expectOk(
      await api.get<ConnectionResponse>(`/api/workspaces/${ctx.workspaceSlug}/meta`, {
        auth: ctx.accessToken,
      }),
    );
    expect(after.connection?.lastRotatedAt).not.toBeNull();
  });

  test('disconnect flips status to REVOKED and hides the connection from GET /meta', async () => {
    const ctx = await bootstrapWorkspace();
    const cb = await completeMockOAuth(ctx.accessToken, ctx.workspaceSlug);

    expectOk(
      await api.del<{ ok: true }>(`/api/workspaces/${ctx.workspaceSlug}/meta/${cb.connection.id}`, {
        auth: ctx.accessToken,
      }),
    );

    const after = expectOk(
      await api.get<ConnectionResponse>(`/api/workspaces/${ctx.workspaceSlug}/meta`, {
        auth: ctx.accessToken,
      }),
    );
    // GET /meta only surfaces ACTIVE connections.
    expect(after.connection).toBeNull();
  });

  test('ad-accounts sync caches the mock provider list and lists it back', async () => {
    const ctx = await bootstrapWorkspace();
    const cb = await completeMockOAuth(ctx.accessToken, ctx.workspaceSlug);

    const synced = expectOk(
      await api.post<{ adAccounts: unknown[] }>(
        `/api/workspaces/${ctx.workspaceSlug}/meta/${cb.connection.id}/ad-accounts/sync`,
        undefined,
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.adAccounts.length).toBeGreaterThanOrEqual(1);

    const listed = expectOk(
      await api.get<{ adAccounts: { metaAdAccountId: string }[] }>(
        `/api/workspaces/${ctx.workspaceSlug}/meta/${cb.connection.id}/ad-accounts`,
        { auth: ctx.accessToken },
      ),
    );
    expect(listed.adAccounts.length).toBe(synced.adAccounts.length);
    expect(listed.adAccounts[0]?.metaAdAccountId).toMatch(/^act_/);
  });

  test('a stranger workspace cannot touch another workspace’s connection', async () => {
    const owner = await bootstrapWorkspace();
    const cb = await completeMockOAuth(owner.accessToken, owner.workspaceSlug);

    const stranger = await bootstrapWorkspace();
    const res = await api.get<unknown>(
      `/api/workspaces/${stranger.workspaceSlug}/meta/${cb.connection.id}/ad-accounts`,
      { auth: stranger.accessToken },
    );
    expect(res.body.success).toBe(false);
  });
});
