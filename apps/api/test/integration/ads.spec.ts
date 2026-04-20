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

interface AdListResponse {
  ads: {
    id: string;
    name: string;
    status: string;
    creativeId: string | null;
    metaAdId: string;
  }[];
}

interface AdDetail {
  ad: {
    id: string;
    name: string;
    status: string;
    creativeId: string | null;
  };
}

interface CreativeDetail {
  creative: { id: string; metaCreativeId: string; name: string; kind: string };
}

async function bootstrapWithAdSetAndCreative(): Promise<{
  accessToken: string;
  slug: string;
  adsetId: string;
  creativeId: string;
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

  const init = expectOk(
    await api.post<{ authorizeUrl: string }>(
      `/api/workspaces/${slug}/meta/connect/init`,
      undefined,
      { auth: owner.accessToken },
    ),
  );
  const url = new URL(init.authorizeUrl);
  expectOk(
    await api.post(
      '/api/meta/connect/callback',
      { code: url.searchParams.get('code') ?? '', state: url.searchParams.get('state') ?? '' },
      { auth: owner.accessToken },
    ),
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
  const accounts = expectOk(
    await api.get<{ adAccounts: { id: string }[] }>(
      `/api/workspaces/${slug}/meta/${conn.connection.id}/ad-accounts`,
      { auth: owner.accessToken },
    ),
  );
  const adAccountId = accounts.adAccounts[0]?.id;
  if (!adAccountId) throw new Error('no ad account');

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

  expectOk(
    await api.post(`/api/workspaces/${slug}/campaigns/${campaignId}/adsets/sync`, undefined, {
      auth: owner.accessToken,
    }),
  );
  const adsets = expectOk(
    await api.get<{ adSets: { id: string }[] }>(
      `/api/workspaces/${slug}/campaigns/${campaignId}/adsets`,
      { auth: owner.accessToken },
    ),
  );
  const adsetId = adsets.adSets[0]?.id;
  if (!adsetId) throw new Error('no adset');

  // Sync creatives once so we have one attached to the ad account.
  expectOk(
    await api.post<{ syncedCount: number }>(
      `/api/workspaces/${slug}/adaccounts/${adAccountId}/creatives/sync`,
      undefined,
      { auth: owner.accessToken },
    ),
  );
  const creatives = expectOk(
    await api.get<{ creatives: { id: string }[] }>(
      `/api/workspaces/${slug}/adaccounts/${adAccountId}/creatives`,
      { auth: owner.accessToken },
    ),
  );
  const creativeId = creatives.creatives[0]?.id;
  if (!creativeId) throw new Error('no creative');

  return { accessToken: owner.accessToken, slug, adsetId, creativeId, adAccountId };
}

describe('Module 07 — Ads + Creatives against the mock provider', () => {
  test('creative sync populates the library, list surfaces them', async () => {
    const ctx = await bootstrapWithAdSetAndCreative();
    const list = expectOk(
      await api.get<{ creatives: { kind: string }[] }>(`/api/workspaces/${ctx.slug}/creatives`, {
        auth: ctx.accessToken,
      }),
    );
    expect(list.creatives.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(list.creatives.map((c) => c.kind));
    expect(kinds.has('IMAGE') || kinds.has('VIDEO')).toBe(true);
  });

  test('create creative round-trip', async () => {
    const ctx = await bootstrapWithAdSetAndCreative();
    const created = expectOk(
      await api.post<CreativeDetail>(
        `/api/workspaces/${ctx.slug}/creatives`,
        {
          adAccountId: ctx.adAccountId,
          name: 'New Creative',
          kind: 'IMAGE',
          thumbUrl: 'https://cdn.example.com/img.jpg',
        },
        { auth: ctx.accessToken },
      ),
    );
    expect(created.creative.name).toBe('New Creative');
    expect(created.creative.kind).toBe('IMAGE');
  });

  test('ad sync pulls fixture ads for an ad set', async () => {
    const ctx = await bootstrapWithAdSetAndCreative();
    const synced = expectOk(
      await api.post<{ syncedCount: number }>(
        `/api/workspaces/${ctx.slug}/adsets/${ctx.adsetId}/ads/sync`,
        undefined,
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.syncedCount).toBe(2);

    const list = expectOk(
      await api.get<AdListResponse>(`/api/workspaces/${ctx.slug}/adsets/${ctx.adsetId}/ads`, {
        auth: ctx.accessToken,
      }),
    );
    expect(list.ads.length).toBe(2);
  });

  test('ad create → update → delete round-trip', async () => {
    const ctx = await bootstrapWithAdSetAndCreative();
    const created = expectOk(
      await api.post<AdDetail>(
        `/api/workspaces/${ctx.slug}/adsets/${ctx.adsetId}/ads`,
        {
          name: 'Integration Ad',
          status: 'PAUSED',
          creativeId: ctx.creativeId,
        },
        { auth: ctx.accessToken },
      ),
    );
    expect(created.ad.name).toBe('Integration Ad');
    expect(created.ad.creativeId).toBe(ctx.creativeId);

    const updated = expectOk(
      await api.patch<AdDetail>(
        `/api/workspaces/${ctx.slug}/ads/${created.ad.id}`,
        { status: 'ACTIVE', name: 'Activated' },
        { auth: ctx.accessToken },
      ),
    );
    expect(updated.ad.status).toBe('ACTIVE');
    expect(updated.ad.name).toBe('Activated');

    expectOk(
      await api.del<{ ok: true }>(`/api/workspaces/${ctx.slug}/ads/${created.ad.id}`, {
        auth: ctx.accessToken,
      }),
    );

    const afterDelete = expectOk(
      await api.get<AdDetail>(`/api/workspaces/${ctx.slug}/ads/${created.ad.id}`, {
        auth: ctx.accessToken,
      }),
    );
    expect(afterDelete.ad.status).toBe('DELETED');
  });

  test('creative delete refuses when an active ad still references it', async () => {
    const ctx = await bootstrapWithAdSetAndCreative();
    expectOk(
      await api.post<AdDetail>(
        `/api/workspaces/${ctx.slug}/adsets/${ctx.adsetId}/ads`,
        { name: 'Uses Creative', status: 'PAUSED', creativeId: ctx.creativeId },
        { auth: ctx.accessToken },
      ),
    );
    const res = await api.del<unknown>(`/api/workspaces/${ctx.slug}/creatives/${ctx.creativeId}`, {
      auth: ctx.accessToken,
    });
    expect(res.body.success).toBe(false);
    if (!res.body.success) {
      expect(res.body.error.message).toBe('creative_in_use');
    }
  });

  test('a stranger cannot touch another workspace’s ad by id', async () => {
    const owner = await bootstrapWithAdSetAndCreative();
    const created = expectOk(
      await api.post<AdDetail>(
        `/api/workspaces/${owner.slug}/adsets/${owner.adsetId}/ads`,
        { name: 'Private', status: 'PAUSED', creativeId: owner.creativeId },
        { auth: owner.accessToken },
      ),
    );

    const stranger = await bootstrapWithAdSetAndCreative();
    const res = await api.patch<unknown>(
      `/api/workspaces/${stranger.slug}/ads/${created.ad.id}`,
      { name: 'Pwned' },
      { auth: stranger.accessToken },
    );
    expectErr(res);
  });
});
