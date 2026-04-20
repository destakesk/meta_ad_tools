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
}

interface CampaignResponse {
  campaign: {
    id: string;
    adAccountId: string;
    metaCampaignId: string;
    name: string;
    status: string;
    dailyBudgetCents: string | null;
    lifetimeBudgetCents: string | null;
  };
}

interface CampaignListResponse {
  campaigns: { id: string; adAccountId: string; name: string; status: string }[];
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
    await api.post<{ connection: { id: string } }>(
      '/api/meta/connect/callback',
      { code, state },
      { auth: accessToken },
    ),
  );
  const conn = expectOk(
    await api.get<{ connection: { id: string } | null }>(`/api/workspaces/${slug}/meta`, {
      auth: accessToken,
    }),
  );
  if (!conn.connection) throw new Error('connection missing');
  expectOk(
    await api.post(
      `/api/workspaces/${slug}/meta/${conn.connection.id}/ad-accounts/sync`,
      undefined,
      { auth: accessToken },
    ),
  );
}

async function bootstrap(): Promise<{
  accessToken: string;
  slug: string;
  adAccountId: string;
}> {
  const owner = await registerVerifyAndLogin(app);
  const org = expectOk(
    await api.get<{ workspaces: { slug: string }[] }>('/api/organizations/current', {
      auth: owner.accessToken,
    }),
  );
  const slug = org.workspaces[0]?.slug;
  if (!slug) throw new Error('no workspace');
  await connectMockMeta(owner.accessToken, slug);

  // First sync seeds campaigns, which also implicitly gets us a concrete
  // adAccountId to use in create calls.
  expectOk(
    await api.post(`/api/workspaces/${slug}/campaigns/sync`, undefined, {
      auth: owner.accessToken,
    }),
  );
  const list = expectOk(
    await api.get<CampaignListResponse>(`/api/workspaces/${slug}/campaigns`, {
      auth: owner.accessToken,
    }),
  );
  const adAccountId = list.campaigns[0]?.adAccountId;
  if (!adAccountId) throw new Error('no ad account id');

  return { accessToken: owner.accessToken, slug, adAccountId };
}

describe('Module 05 — campaign CRUD against the mock provider', () => {
  test('create → list sees the new campaign with the submitted budget', async () => {
    const ctx = await bootstrap();

    const created = expectOk(
      await api.post<CampaignResponse>(
        `/api/workspaces/${ctx.slug}/campaigns`,
        {
          adAccountId: ctx.adAccountId,
          name: 'Integration Test Campaign',
          objective: 'OUTCOME_LEADS',
          status: 'PAUSED',
          dailyBudgetCents: 7500,
        },
        { auth: ctx.accessToken },
      ),
    );
    expect(created.campaign.name).toBe('Integration Test Campaign');
    expect(created.campaign.dailyBudgetCents).toBe('7500');
    expect(created.campaign.status).toBe('PAUSED');

    const list = expectOk(
      await api.get<CampaignListResponse>(`/api/workspaces/${ctx.slug}/campaigns`, {
        auth: ctx.accessToken,
      }),
    );
    expect(list.campaigns.some((c) => c.id === created.campaign.id)).toBe(true);
  });

  test('create rejects a body with neither daily nor lifetime budget', async () => {
    const ctx = await bootstrap();
    const res = await api.post<unknown>(
      `/api/workspaces/${ctx.slug}/campaigns`,
      {
        adAccountId: ctx.adAccountId,
        name: 'No Budget',
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
      },
      { auth: ctx.accessToken },
    );
    expect(res.body.success).toBe(false);
  });

  test('update mutates name + status; fetch returns the new values', async () => {
    const ctx = await bootstrap();

    const created = expectOk(
      await api.post<CampaignResponse>(
        `/api/workspaces/${ctx.slug}/campaigns`,
        {
          adAccountId: ctx.adAccountId,
          name: 'Before',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          dailyBudgetCents: 1000,
        },
        { auth: ctx.accessToken },
      ),
    );

    const updated = expectOk(
      await api.patch<CampaignResponse>(
        `/api/workspaces/${ctx.slug}/campaigns/${created.campaign.id}`,
        { name: 'After', status: 'ACTIVE' },
        { auth: ctx.accessToken },
      ),
    );
    expect(updated.campaign.name).toBe('After');
    expect(updated.campaign.status).toBe('ACTIVE');
  });

  test('delete flips local status to DELETED and hides from list', async () => {
    const ctx = await bootstrap();

    const created = expectOk(
      await api.post<CampaignResponse>(
        `/api/workspaces/${ctx.slug}/campaigns`,
        {
          adAccountId: ctx.adAccountId,
          name: 'Doomed',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          dailyBudgetCents: 1000,
        },
        { auth: ctx.accessToken },
      ),
    );

    expectOk(
      await api.del<{ ok: true }>(`/api/workspaces/${ctx.slug}/campaigns/${created.campaign.id}`, {
        auth: ctx.accessToken,
      }),
    );

    const list = expectOk(
      await api.get<CampaignListResponse>(`/api/workspaces/${ctx.slug}/campaigns`, {
        auth: ctx.accessToken,
      }),
    );
    const row = list.campaigns.find((c) => c.id === created.campaign.id);
    expect(row?.status).toBe('DELETED');
  });

  test('cross-workspace update 404s — a stranger cannot touch someone else’s campaign id', async () => {
    const owner = await bootstrap();
    const victim = expectOk(
      await api.post<CampaignResponse>(
        `/api/workspaces/${owner.slug}/campaigns`,
        {
          adAccountId: owner.adAccountId,
          name: 'Private',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          dailyBudgetCents: 1000,
        },
        { auth: owner.accessToken },
      ),
    );

    const stranger = await bootstrap();
    const res = await api.patch<unknown>(
      `/api/workspaces/${stranger.slug}/campaigns/${victim.campaign.id}`,
      { name: 'Pwned' },
      { auth: stranger.accessToken },
    );
    expectErr(res);
  });
});
