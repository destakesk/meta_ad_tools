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

interface AdSetListResponse {
  adSets: {
    id: string;
    name: string;
    status: string;
    optimizationGoal: string | null;
    dailyBudgetCents: string | null;
  }[];
}

interface AdSetDetail {
  adSet: {
    id: string;
    name: string;
    status: string;
    dailyBudgetCents: string | null;
    lifetimeBudgetCents: string | null;
  };
}

async function bootstrapWithCampaign(): Promise<{
  accessToken: string;
  slug: string;
  campaignId: string;
}> {
  const owner = await registerVerifyAndLogin(app);
  const org = expectOk(
    await api.get<{ workspaces: { slug: string }[] }>('/api/organizations/current', {
      auth: owner.accessToken,
    }),
  );
  const slug = org.workspaces[0]?.slug;
  if (!slug) throw new Error('no workspace');

  // Connect mock meta + sync ad accounts + sync campaigns so we have a
  // real `campaignId` to hang ad-sets off.
  const init = expectOk(
    await api.post<{ authorizeUrl: string }>(
      `/api/workspaces/${slug}/meta/connect/init`,
      undefined,
      { auth: owner.accessToken },
    ),
  );
  const url = new URL(init.authorizeUrl);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  expectOk(
    await api.post('/api/meta/connect/callback', { code, state }, { auth: owner.accessToken }),
  );
  const conn = expectOk(
    await api.get<{ connection: { id: string } | null }>(`/api/workspaces/${slug}/meta`, {
      auth: owner.accessToken,
    }),
  );
  if (!conn.connection) throw new Error('connection missing');
  expectOk(
    await api.post(
      `/api/workspaces/${slug}/meta/${conn.connection.id}/ad-accounts/sync`,
      undefined,
      { auth: owner.accessToken },
    ),
  );
  expectOk(
    await api.post(`/api/workspaces/${slug}/campaigns/sync`, undefined, {
      auth: owner.accessToken,
    }),
  );
  const campaigns = expectOk(
    await api.get<{ campaigns: { id: string }[] }>(`/api/workspaces/${slug}/campaigns`, {
      auth: owner.accessToken,
    }),
  );
  const campaignId = campaigns.campaigns[0]?.id;
  if (!campaignId) throw new Error('no campaign');

  return { accessToken: owner.accessToken, slug, campaignId };
}

describe('Module 06 — AdSets against the mock provider', () => {
  test('sync pulls fixture ad sets, list surfaces them', async () => {
    const ctx = await bootstrapWithCampaign();

    const synced = expectOk(
      await api.post<{ syncedCount: number }>(
        `/api/workspaces/${ctx.slug}/campaigns/${ctx.campaignId}/adsets/sync`,
        undefined,
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.syncedCount).toBe(2); // two fixture ad sets per campaign

    const list = expectOk(
      await api.get<AdSetListResponse>(
        `/api/workspaces/${ctx.slug}/campaigns/${ctx.campaignId}/adsets`,
        { auth: ctx.accessToken },
      ),
    );
    expect(list.adSets.length).toBe(2);
    const statuses = list.adSets.map((s) => s.status).sort();
    expect(statuses).toEqual(['ACTIVE', 'PAUSED']);
  });

  test('create → list → update → delete round-trip', async () => {
    const ctx = await bootstrapWithCampaign();

    const created = expectOk(
      await api.post<AdSetDetail>(
        `/api/workspaces/${ctx.slug}/campaigns/${ctx.campaignId}/adsets`,
        {
          name: 'Integration Test Ad Set',
          status: 'PAUSED',
          optimizationGoal: 'LINK_CLICKS',
          billingEvent: 'IMPRESSIONS',
          dailyBudgetCents: 5000,
        },
        { auth: ctx.accessToken },
      ),
    );
    expect(created.adSet.name).toBe('Integration Test Ad Set');
    expect(created.adSet.dailyBudgetCents).toBe('5000');

    const updated = expectOk(
      await api.patch<AdSetDetail>(
        `/api/workspaces/${ctx.slug}/adsets/${created.adSet.id}`,
        { name: 'Renamed', status: 'ACTIVE' },
        { auth: ctx.accessToken },
      ),
    );
    expect(updated.adSet.name).toBe('Renamed');
    expect(updated.adSet.status).toBe('ACTIVE');

    expectOk(
      await api.del<{ ok: true }>(`/api/workspaces/${ctx.slug}/adsets/${created.adSet.id}`, {
        auth: ctx.accessToken,
      }),
    );

    const afterDelete = expectOk(
      await api.get<AdSetDetail>(`/api/workspaces/${ctx.slug}/adsets/${created.adSet.id}`, {
        auth: ctx.accessToken,
      }),
    );
    expect(afterDelete.adSet.status).toBe('DELETED');
  });

  test('create rejects when neither daily nor lifetime budget is set', async () => {
    const ctx = await bootstrapWithCampaign();
    const res = await api.post<unknown>(
      `/api/workspaces/${ctx.slug}/campaigns/${ctx.campaignId}/adsets`,
      {
        name: 'No Budget',
        status: 'PAUSED',
        optimizationGoal: 'LINK_CLICKS',
        billingEvent: 'IMPRESSIONS',
      },
      { auth: ctx.accessToken },
    );
    expect(res.body.success).toBe(false);
  });

  test('a stranger cannot touch another workspace’s ad set by id', async () => {
    const owner = await bootstrapWithCampaign();
    const created = expectOk(
      await api.post<AdSetDetail>(
        `/api/workspaces/${owner.slug}/campaigns/${owner.campaignId}/adsets`,
        {
          name: 'Private',
          status: 'PAUSED',
          optimizationGoal: 'LINK_CLICKS',
          billingEvent: 'IMPRESSIONS',
          dailyBudgetCents: 1000,
        },
        { auth: owner.accessToken },
      ),
    );

    const stranger = await bootstrapWithCampaign();
    const res = await api.patch<unknown>(
      `/api/workspaces/${stranger.slug}/adsets/${created.adSet.id}`,
      { name: 'Pwned' },
      { auth: stranger.accessToken },
    );
    expectErr(res);
  });
});
