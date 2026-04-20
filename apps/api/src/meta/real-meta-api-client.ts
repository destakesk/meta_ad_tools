import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  AuthorizeUrlInput,
  ExchangeCodeInput,
  FetchCampaignsInput,
  FetchInsightsInput,
  MetaAdAccountSnapshot,
  MetaApiClient,
  MetaCampaignSnapshot,
  MetaCampaignStatus,
  MetaInsightSnapshot,
  MetaTokenSet,
  MetaUserProfile,
} from './meta-api-client.interface.js';
import type { AppConfig } from '../config/configuration.js';

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';
const OAUTH_BASE = 'https://www.facebook.com/v22.0/dialog/oauth';

/**
 * Real Graph API binding. Activated by META_OAUTH_MODE=real and only meant
 * for staging / production once the Meta business app is approved. The dev
 * / CI suite continues to use MockMetaApiClient; this class avoids any
 * import-time network calls so swapping it in stays a one-line provider
 * change.
 */
@Injectable()
export class RealMetaApiClient implements MetaApiClient {
  private readonly logger = new Logger(RealMetaApiClient.name);
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const meta = config.get('meta', { infer: true });
    this.appId = meta.appId;
    this.appSecret = meta.appSecret;
  }

  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    const url = new URL(OAUTH_BASE);
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('state', input.state);
    url.searchParams.set('scope', input.scopes.join(','));
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<MetaTokenSet> {
    const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('client_secret', this.appSecret);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('code', input.code);

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      this.logger.error({ status: res.status }, 'meta token exchange failed');
      throw new BadGatewayException('meta_token_exchange_failed');
    }
    const body = (await res.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };
    return {
      accessToken: body.access_token,
      refreshToken: undefined, // Meta long-lived flow handles rotation server-side
      expiresInSeconds: body.expires_in ?? null,
      scopes: input.redirectUri.includes('scope=') ? [] : ['ads_management', 'ads_read'],
    };
  }

  async rotate(token: MetaTokenSet): Promise<MetaTokenSet> {
    // Meta exchanges short-lived → long-lived via fb_exchange_token.
    const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('client_secret', this.appSecret);
    url.searchParams.set('fb_exchange_token', token.accessToken);

    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_token_rotation_failed');
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    return {
      accessToken: body.access_token,
      refreshToken: token.refreshToken,
      expiresInSeconds: body.expires_in ?? null,
      scopes: token.scopes,
    };
  }

  async fetchProfile(accessToken: string): Promise<MetaUserProfile> {
    const url = new URL(`${GRAPH_BASE}/me`);
    url.searchParams.set('fields', 'id,name');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_profile_fetch_failed');
    const body = (await res.json()) as { id: string; name: string };
    return { metaUserId: body.id, displayName: body.name };
  }

  async fetchAdAccounts(accessToken: string): Promise<MetaAdAccountSnapshot[]> {
    const url = new URL(`${GRAPH_BASE}/me/adaccounts`);
    url.searchParams.set('fields', 'id,account_id,name,currency,timezone_name,account_status');
    url.searchParams.set('limit', '250');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_adaccounts_fetch_failed');
    const body = (await res.json()) as {
      data: {
        id: string;
        account_id: string;
        name: string;
        currency: string;
        timezone_name?: string;
        account_status?: number;
      }[];
    };
    return body.data.map((a) => ({
      metaAdAccountId: `act_${a.account_id}`,
      name: a.name,
      currency: a.currency,
      timezone: a.timezone_name ?? null,
      status: a.account_status !== undefined ? String(a.account_status) : null,
    }));
  }

  async fetchCampaigns(input: FetchCampaignsInput): Promise<MetaCampaignSnapshot[]> {
    const url = new URL(`${GRAPH_BASE}/${input.metaAdAccountId}/campaigns`);
    url.searchParams.set(
      'fields',
      [
        'id',
        'name',
        'objective',
        'status',
        'daily_budget',
        'lifetime_budget',
        'currency',
        'start_time',
        'stop_time',
      ].join(','),
    );
    url.searchParams.set('limit', '250');
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_campaigns_fetch_failed');
    const body = (await res.json()) as {
      data: {
        id: string;
        name: string;
        objective?: string;
        status?: string;
        daily_budget?: string;
        lifetime_budget?: string;
        currency?: string;
        start_time?: string;
        stop_time?: string;
      }[];
    };
    return body.data.map((c) => ({
      metaCampaignId: c.id,
      name: c.name,
      objective: c.objective ?? null,
      status: normaliseCampaignStatus(c.status),
      dailyBudgetCents: c.daily_budget ?? null,
      lifetimeBudgetCents: c.lifetime_budget ?? null,
      currency: c.currency ?? null,
      startTime: c.start_time ?? null,
      endTime: c.stop_time ?? null,
    }));
  }

  async fetchInsights(input: FetchInsightsInput): Promise<MetaInsightSnapshot[]> {
    const url = new URL(`${GRAPH_BASE}/${input.metaAdAccountId}/insights`);
    url.searchParams.set('level', 'campaign');
    url.searchParams.set('time_increment', '1');
    url.searchParams.set('time_range', JSON.stringify({ since: input.from, until: input.to }));
    url.searchParams.set(
      'filtering',
      JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: input.metaCampaignIds }]),
    );
    url.searchParams.set(
      'fields',
      [
        'campaign_id',
        'date_start',
        'impressions',
        'clicks',
        'spend',
        'conversions',
        'reach',
        'frequency',
        'cpm',
        'ctr',
      ].join(','),
    );
    url.searchParams.set('limit', '500');
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_insights_fetch_failed');
    const body = (await res.json()) as {
      data: {
        campaign_id: string;
        date_start: string;
        impressions?: string;
        clicks?: string;
        spend?: string;
        conversions?: string;
        reach?: string;
        frequency?: string;
        cpm?: string;
        ctr?: string;
      }[];
    };
    return body.data.map((row) => ({
      metaCampaignId: row.campaign_id,
      date: row.date_start,
      impressions: row.impressions ?? '0',
      clicks: row.clicks ?? '0',
      spendCents: toMinorUnits(row.spend ?? '0'),
      conversions: row.conversions ?? '0',
      reach: row.reach ?? '0',
      frequency: row.frequency !== undefined ? Number(row.frequency) : 0,
      cpmCents: row.cpm !== undefined ? toMinorUnits(row.cpm) : null,
      ctr: row.ctr !== undefined ? Number(row.ctr) : null,
    }));
  }

  async revoke(accessToken: string): Promise<void> {
    const url = new URL(`${GRAPH_BASE}/me/permissions`);
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      this.logger.warn({ status: res.status }, 'meta revoke responded non-2xx');
    }
  }
}

function normaliseCampaignStatus(raw: string | undefined): MetaCampaignStatus {
  switch ((raw ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'PAUSED':
      return 'PAUSED';
    case 'DELETED':
      return 'DELETED';
    case 'ARCHIVED':
      return 'ARCHIVED';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Graph returns spend + cpm in the ad account's currency MAJOR units
 * (`"12.34"` for 12 dollars 34 cents). We store everything in minor units
 * to keep downstream aggregation integer-safe; multiply by 100 and round.
 */
function toMinorUnits(major: string): string {
  const n = Number(major);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n * 100).toString();
}
