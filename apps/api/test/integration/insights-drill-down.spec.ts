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

interface InsightListBody {
  rows: { date: string; impressions: string; clicks: string }[];
  totals: { impressions: string; clicks: string; spendCents: string; conversions: string };
  from: string;
  to: string;
}

async function bootstrapWithAdAndAdSet(): Promise<{
  accessToken: string;
  slug: string;
  adsetId: string;
  adId: string;
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

  expectOk(
    await api.post(`/api/workspaces/${slug}/adsets/${adsetId}/ads/sync`, undefined, {
      auth: owner.accessToken,
    }),
  );
  const ads = expectOk(
    await api.get<{ ads: { id: string }[] }>(`/api/workspaces/${slug}/adsets/${adsetId}/ads`, {
      auth: owner.accessToken,
    }),
  );
  const adId = ads.ads[0]?.id;
  if (!adId) throw new Error('no ad');

  return { accessToken: owner.accessToken, slug, adsetId, adId };
}

const FROM = '2026-04-01';
const TO = '2026-04-07';

describe('Module 08 — AdSet + Ad insights against the mock provider', () => {
  test('adset insights sync populates 7 rows, list returns them with totals', async () => {
    const ctx = await bootstrapWithAdAndAdSet();

    const synced = expectOk(
      await api.post<{ syncedCount: number }>(
        `/api/workspaces/${ctx.slug}/adsets/${ctx.adsetId}/insights/sync`,
        { from: FROM, to: TO },
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.syncedCount).toBe(7);

    const list = expectOk(
      await api.get<InsightListBody>(
        `/api/workspaces/${ctx.slug}/adsets/${ctx.adsetId}/insights?from=${FROM}&to=${TO}`,
        { auth: ctx.accessToken },
      ),
    );
    expect(list.rows.length).toBe(7);
    expect(BigInt(list.totals.impressions)).toBeGreaterThan(0n);
    expect(BigInt(list.totals.clicks)).toBeGreaterThan(0n);
  });

  test('ad insights sync + list round-trip', async () => {
    const ctx = await bootstrapWithAdAndAdSet();

    const synced = expectOk(
      await api.post<{ syncedCount: number }>(
        `/api/workspaces/${ctx.slug}/ads/${ctx.adId}/insights/sync`,
        { from: FROM, to: TO },
        { auth: ctx.accessToken },
      ),
    );
    expect(synced.syncedCount).toBe(7);

    const list = expectOk(
      await api.get<InsightListBody>(
        `/api/workspaces/${ctx.slug}/ads/${ctx.adId}/insights?from=${FROM}&to=${TO}`,
        { auth: ctx.accessToken },
      ),
    );
    expect(list.rows.length).toBe(7);
  });

  test('inverted date range is rejected by the validator', async () => {
    // Uses a lighter-weight bootstrap: no need for the full Meta sync chain,
    // because the inverted-range guard fires before any DB hit.
    const owner = await registerVerifyAndLogin(app);
    const org = expectOk(
      await api.get<{ workspaces: { slug: string }[] }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );
    const slug = org.workspaces[0]?.slug;
    if (!slug) throw new Error('no workspace');

    const res = await api.post<unknown>(
      `/api/workspaces/${slug}/adsets/does-not-exist/insights/sync`,
      { from: TO, to: FROM },
      { auth: owner.accessToken },
    );
    expect(res.body.success).toBe(false);
  });

  test('a stranger cannot read another workspace’s adset insights', async () => {
    const owner = await bootstrapWithAdAndAdSet();
    expectOk(
      await api.post<{ syncedCount: number }>(
        `/api/workspaces/${owner.slug}/adsets/${owner.adsetId}/insights/sync`,
        { from: FROM, to: TO },
        { auth: owner.accessToken },
      ),
    );

    const stranger = await bootstrapWithAdAndAdSet();
    const res = await api.get<unknown>(
      `/api/workspaces/${stranger.slug}/adsets/${owner.adsetId}/insights?from=${FROM}&to=${TO}`,
      { auth: stranger.accessToken },
    );
    expectErr(res);
  });
});
