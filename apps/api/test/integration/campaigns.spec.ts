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

interface InitResponse {
  authorizeUrl: string;
}

interface CallbackResponse {
  connection: { id: string };
  workspaceSlug: string;
}

interface CampaignListResponse {
  campaigns: {
    id: string;
    metaCampaignId: string;
    status: string;
    dailyBudgetCents: string | null;
    lifetimeBudgetCents: string | null;
    currency: string | null;
    metaAdAccountId: string;
  }[];
}

interface InsightListResponse {
  rows: { campaignId: string; date: string; impressions: string }[];
  totals: { impressions: string; clicks: string; spendCents: string };
  from: string;
  to: string;
}

async function connectMockMeta(accessToken: string, slug: string): Promise<void> {
  const init = expectOk(
    await api.post<InitResponse>(`/api/workspaces/${slug}/meta/connect/init`, undefined, {
      auth: accessToken,
    }),
  );
  const url = new URL(init.authorizeUrl);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  expectOk(
    await api.post<CallbackResponse>(
      '/api/meta/connect/callback',
      { code, state },
      { auth: accessToken },
    ),
  );
  // connect alone leaves ad_accounts empty; sync pulls the mock list.
  const conn = expectOk(
    await api.get<{ connection: { id: string } | null }>(`/api/workspaces/${slug}/meta`, {
      auth: accessToken,
    }),
  );
  if (!conn.connection) throw new Error('connection missing after callback');
  expectOk(
    await api.post<{ adAccounts: unknown[] }>(
      `/api/workspaces/${slug}/meta/${conn.connection.id}/ad-accounts/sync`,
      undefined,
      { auth: accessToken },
    ),
  );
}

async function bootstrap(): Promise<{ accessToken: string; slug: string }> {
  const owner = await registerVerifyAndLogin(app);
  const org = expectOk(
    await api.get<{ workspaces: { slug: string }[] }>('/api/organizations/current', {
      auth: owner.accessToken,
    }),
  );
  const slug = org.workspaces[0]?.slug;
  if (!slug) throw new Error('no workspace');
  return { accessToken: owner.accessToken, slug };
}

describe('Module 04 — campaigns + insights against the mock provider', () => {
  test('POST /campaigns/sync inserts two campaigns per mock ad account', async () => {
    const ctx = await bootstrap();
    await connectMockMeta(ctx.accessToken, ctx.slug);

    const synced = expectOk(
      await api.post<{ syncedCount: number; adAccountIds: string[] }>(
        `/api/workspaces/${ctx.slug}/campaigns/sync`,
        undefined,
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.syncedCount).toBe(4); // 2 mock accounts * 2 campaigns
    expect(synced.adAccountIds.length).toBeGreaterThanOrEqual(1);

    const list = expectOk(
      await api.get<CampaignListResponse>(`/api/workspaces/${ctx.slug}/campaigns`, {
        auth: ctx.accessToken,
      }),
    );
    expect(list.campaigns.length).toBe(4);
    const statuses = list.campaigns.map((c) => c.status).sort();
    expect(statuses).toEqual(['ACTIVE', 'ACTIVE', 'PAUSED', 'PAUSED']);
  });

  test('insights sync + list round-trip populates totals that match row sums', async () => {
    const ctx = await bootstrap();
    await connectMockMeta(ctx.accessToken, ctx.slug);
    expectOk(
      await api.post(`/api/workspaces/${ctx.slug}/campaigns/sync`, undefined, {
        auth: ctx.accessToken,
      }),
    );

    const from = '2026-04-01';
    const to = '2026-04-07';
    const synced = expectOk(
      await api.post<{ syncedCount: number }>(
        `/api/workspaces/${ctx.slug}/insights/sync`,
        { from, to },
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.syncedCount).toBe(4 * 7); // 4 campaigns * 7 days

    const list = expectOk(
      await api.get<InsightListResponse>(
        `/api/workspaces/${ctx.slug}/insights?from=${from}&to=${to}`,
        { auth: ctx.accessToken },
      ),
    );
    expect(list.rows.length).toBe(4 * 7);
    expect(list.from).toBe(from);
    expect(list.to).toBe(to);

    const rowSum = list.rows.reduce((acc, r) => acc + BigInt(r.impressions), 0n);
    expect(list.totals.impressions).toBe(rowSum.toString());
  });

  test('sync without any meta connection returns meta_connection_not_found', async () => {
    const ctx = await bootstrap();
    const res = await api.post<unknown>(`/api/workspaces/${ctx.slug}/campaigns/sync`, undefined, {
      auth: ctx.accessToken,
    });
    expect(res.body.success).toBe(false);
  });

  test('insight range validation — inverted range rejected', async () => {
    const ctx = await bootstrap();
    await connectMockMeta(ctx.accessToken, ctx.slug);
    const res = await api.post<unknown>(
      `/api/workspaces/${ctx.slug}/insights/sync`,
      { from: '2026-04-10', to: '2026-04-01' },
      { auth: ctx.accessToken },
    );
    expect(res.body.success).toBe(false);
  });

  test('a stranger cannot reach another workspace’s specific campaign by id', async () => {
    const owner = await bootstrap();
    await connectMockMeta(owner.accessToken, owner.slug);
    expectOk(
      await api.post(`/api/workspaces/${owner.slug}/campaigns/sync`, undefined, {
        auth: owner.accessToken,
      }),
    );
    const ownerList = expectOk(
      await api.get<CampaignListResponse>(`/api/workspaces/${owner.slug}/campaigns`, {
        auth: owner.accessToken,
      }),
    );
    const victimCampaignId = ownerList.campaigns[0]?.id ?? '';
    expect(victimCampaignId).not.toBe('');

    // Both orgs end up with a workspace slug "default" because the registration
    // flow seeds that by default. The slug alone can't leak tenants — the
    // scoped workspace lookup finds the stranger's OWN "default" workspace,
    // and hitting the victim's concrete campaign id from there 404s.
    const stranger = await bootstrap();
    const res = await api.get<unknown>(
      `/api/workspaces/${stranger.slug}/campaigns/${victimCampaignId}`,
      { auth: stranger.accessToken },
    );
    expect(res.body.success).toBe(false);
  });
});
