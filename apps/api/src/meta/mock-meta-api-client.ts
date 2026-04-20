import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import type {
  AuthorizeUrlInput,
  CreateCampaignInput,
  DeleteCampaignInput,
  ExchangeCodeInput,
  FetchCampaignsInput,
  FetchInsightsInput,
  MetaAdAccountSnapshot,
  MetaApiClient,
  MetaCampaignSnapshot,
  MetaInsightSnapshot,
  MetaTokenSet,
  MetaUserProfile,
  UpdateCampaignInput,
} from './meta-api-client.interface.js';

/**
 * In-memory per-ad-account campaign store for the mock provider. Persists
 * for the lifetime of the process so `createCampaign → fetchCampaigns`
 * round-trips reflect writes. Each ad account self-seeds a two-campaign
 * fixture on first access so reads work even without prior writes.
 */
const mockCampaignStore = new Map<string, MetaCampaignSnapshot[]>();

function getOrInitStore(metaAdAccountId: string): MetaCampaignSnapshot[] {
  let list = mockCampaignStore.get(metaAdAccountId);
  if (!list) {
    const shortId = metaAdAccountId.replace('act_', '').slice(-4);
    const currency = metaAdAccountId.endsWith('0001') ? 'TRY' : 'EUR';
    list = [
      {
        metaCampaignId: `campaign_${shortId}_001`,
        name: `Always-On Prospecting ${shortId}`,
        objective: 'OUTCOME_SALES',
        status: 'ACTIVE',
        dailyBudgetCents: '5000',
        lifetimeBudgetCents: null,
        currency,
        startTime: '2026-04-01T00:00:00.000Z',
        endTime: null,
      },
      {
        metaCampaignId: `campaign_${shortId}_002`,
        name: `Q2 Launch ${shortId}`,
        objective: 'OUTCOME_AWARENESS',
        status: 'PAUSED',
        dailyBudgetCents: null,
        lifetimeBudgetCents: '2500000',
        currency,
        startTime: '2026-04-10T00:00:00.000Z',
        endTime: '2026-05-10T00:00:00.000Z',
      },
    ];
    mockCampaignStore.set(metaAdAccountId, list);
  }
  return list;
}

/** Integration-suite helper — clears per-process state between specs. */
export function __resetMockCampaignStore(): void {
  mockCampaignStore.clear();
}

/**
 * Deterministic-enough Meta API stub for dev / CI. Authorize URL points
 * back at our own callback, "code" accepts anything non-empty, tokens are
 * random. Profile + ad-account fixtures are stable across calls so UI
 * snapshots don't drift. Campaigns live in a stateful map so CRUD works
 * end-to-end.
 */
@Injectable()
export class MockMetaApiClient implements MetaApiClient {
  private readonly logger = new Logger(MockMetaApiClient.name);

  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    const url = new URL(input.redirectUri);
    url.searchParams.set('code', `mock-code-${randomUUID()}`);
    url.searchParams.set('state', input.state);
    return url.toString();
  }

  exchangeCode(_input: ExchangeCodeInput): Promise<MetaTokenSet> {
    return Promise.resolve({
      accessToken: `mock-access-${randomBytes(16).toString('hex')}`,
      refreshToken: `mock-refresh-${randomBytes(16).toString('hex')}`,
      expiresInSeconds: 3600,
      scopes: ['ads_management', 'ads_read', 'business_management'],
    });
  }

  rotate(token: MetaTokenSet): Promise<MetaTokenSet> {
    return Promise.resolve({
      accessToken: `mock-access-${randomBytes(16).toString('hex')}`,
      refreshToken: token.refreshToken,
      expiresInSeconds: 3600,
      scopes: token.scopes,
    });
  }

  fetchProfile(_accessToken: string): Promise<MetaUserProfile> {
    return Promise.resolve({
      metaUserId: '100000000000001',
      displayName: 'Mock Meta User',
    });
  }

  fetchAdAccounts(_accessToken: string): Promise<MetaAdAccountSnapshot[]> {
    return Promise.resolve([
      {
        metaAdAccountId: 'act_1000000000000001',
        name: 'Demo Account TR',
        currency: 'TRY',
        timezone: 'Europe/Istanbul',
        status: 'ACTIVE',
      },
      {
        metaAdAccountId: 'act_1000000000000002',
        name: 'Demo Account EU',
        currency: 'EUR',
        timezone: 'Europe/Berlin',
        status: 'ACTIVE',
      },
    ]);
  }

  fetchCampaigns(input: FetchCampaignsInput): Promise<MetaCampaignSnapshot[]> {
    const list = getOrInitStore(input.metaAdAccountId);
    return Promise.resolve(list.filter((c) => c.status !== 'DELETED'));
  }

  createCampaign(input: CreateCampaignInput): Promise<MetaCampaignSnapshot> {
    const list = getOrInitStore(input.metaAdAccountId);
    const currency = input.metaAdAccountId.endsWith('0001') ? 'TRY' : 'EUR';
    const snapshot: MetaCampaignSnapshot = {
      metaCampaignId: `campaign_${Date.now().toString()}_${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      objective: input.objective,
      status: input.status,
      dailyBudgetCents: input.dailyBudgetCents ?? null,
      lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
      currency,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
    };
    list.push(snapshot);
    return Promise.resolve(snapshot);
  }

  updateCampaign(input: UpdateCampaignInput): Promise<MetaCampaignSnapshot> {
    for (const [, list] of mockCampaignStore) {
      const existing = list.find((c) => c.metaCampaignId === input.metaCampaignId);
      if (existing) {
        if (input.name !== undefined) existing.name = input.name;
        if (input.status !== undefined) existing.status = input.status;
        if (input.dailyBudgetCents !== undefined)
          existing.dailyBudgetCents = input.dailyBudgetCents;
        if (input.lifetimeBudgetCents !== undefined) {
          existing.lifetimeBudgetCents = input.lifetimeBudgetCents;
        }
        if (input.endTime !== undefined) existing.endTime = input.endTime;
        return Promise.resolve(existing);
      }
    }
    throw new Error(`mock: campaign ${input.metaCampaignId} not found`);
  }

  deleteCampaign(input: DeleteCampaignInput): Promise<void> {
    for (const [, list] of mockCampaignStore) {
      const existing = list.find((c) => c.metaCampaignId === input.metaCampaignId);
      if (existing) {
        existing.status = 'DELETED';
        return Promise.resolve();
      }
    }
    throw new Error(`mock: campaign ${input.metaCampaignId} not found`);
  }

  /**
   * Deterministic insight fixture — synthesises a row per (campaignId, day)
   * in the inclusive range with numbers that vary per campaign hash so
   * totals and per-row sorting are non-trivial in tests.
   */
  fetchInsights(input: FetchInsightsInput): Promise<MetaInsightSnapshot[]> {
    const rows: MetaInsightSnapshot[] = [];
    const from = new Date(`${input.from}T00:00:00Z`);
    const to = new Date(`${input.to}T00:00:00Z`);
    for (const id of input.metaCampaignIds) {
      const seed = Math.abs(hashString(id)) % 17;
      for (let d = new Date(from); d.getTime() <= to.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.getUTCDate();
        const impressions = BigInt((seed + 1) * 1000 + day * 37);
        const clicks = BigInt((seed + 1) * 20 + day * 3);
        const spendCents = BigInt((seed + 1) * 300 + day * 11);
        const conversions = BigInt(Math.max(0, day - seed));
        const reach = impressions / 3n;
        const frequency = Number(impressions) / Math.max(1, Number(reach));
        const cpmCents = impressions > 0n ? (spendCents * 1000n) / impressions : null;
        const ctr = impressions > 0n ? Number(clicks) / Number(impressions) : null;
        rows.push({
          metaCampaignId: id,
          date: d.toISOString().slice(0, 10),
          impressions: impressions.toString(),
          clicks: clicks.toString(),
          spendCents: spendCents.toString(),
          conversions: conversions.toString(),
          reach: reach.toString(),
          frequency: Number(frequency.toFixed(4)),
          cpmCents: cpmCents !== null ? cpmCents.toString() : null,
          ctr,
        });
      }
    }
    return Promise.resolve(rows);
  }

  revoke(_accessToken: string): Promise<void> {
    this.logger.debug('mock revoke — nothing to call');
    return Promise.resolve();
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
