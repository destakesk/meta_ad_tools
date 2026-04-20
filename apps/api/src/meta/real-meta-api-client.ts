import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  AuthorizeUrlInput,
  CreateAdInput,
  CreateAdSetInput,
  CreateCampaignInput,
  CreateCreativeInput,
  DeleteAdInput,
  DeleteAdSetInput,
  DeleteCampaignInput,
  DeleteCreativeInput,
  ExchangeCodeInput,
  FetchAdInsightsInput,
  FetchAdSetInsightsInput,
  FetchAdSetsInput,
  FetchAdsInput,
  FetchCampaignsInput,
  FetchCreativesInput,
  FetchInsightsInput,
  MetaAdAccountSnapshot,
  MetaAdInsightSnapshot,
  MetaAdSetInsightSnapshot,
  MetaAdSetSnapshot,
  MetaAdSetStatus,
  MetaAdSnapshot,
  MetaAdStatus,
  MetaApiClient,
  MetaCampaignSnapshot,
  MetaCampaignStatus,
  MetaCreativeKind,
  MetaCreativeSnapshot,
  MetaInsightSnapshot,
  MetaTokenSet,
  MetaUserProfile,
  UpdateAdInput,
  UpdateAdSetInput,
  UpdateCampaignInput,
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

  async fetchAdSetInsights(input: FetchAdSetInsightsInput): Promise<MetaAdSetInsightSnapshot[]> {
    const body = await this.fetchInsightRaw({
      accessToken: input.accessToken,
      metaAdAccountId: input.metaAdAccountId,
      level: 'adset',
      idField: 'adset.id',
      idKey: 'adset_id',
      ids: input.metaAdSetIds,
      from: input.from,
      to: input.to,
    });
    return body.map((row) => ({
      metaAdSetId: row.id,
      date: row.date,
      impressions: row.impressions,
      clicks: row.clicks,
      spendCents: row.spendCents,
      conversions: row.conversions,
      reach: row.reach,
      frequency: row.frequency,
      cpmCents: row.cpmCents,
      ctr: row.ctr,
    }));
  }

  async fetchAdInsights(input: FetchAdInsightsInput): Promise<MetaAdInsightSnapshot[]> {
    const body = await this.fetchInsightRaw({
      accessToken: input.accessToken,
      metaAdAccountId: input.metaAdAccountId,
      level: 'ad',
      idField: 'ad.id',
      idKey: 'ad_id',
      ids: input.metaAdIds,
      from: input.from,
      to: input.to,
    });
    return body.map((row) => ({
      metaAdId: row.id,
      date: row.date,
      impressions: row.impressions,
      clicks: row.clicks,
      spendCents: row.spendCents,
      conversions: row.conversions,
      reach: row.reach,
      frequency: row.frequency,
      cpmCents: row.cpmCents,
      ctr: row.ctr,
    }));
  }

  /**
   * Shared shape for adset/ad insight fetches — Graph uses a `level` +
   * `filtering` pair that's symmetric per level, so we unify the call here
   * and let the two public methods reshape into the per-level snapshot.
   */
  private async fetchInsightRaw(opts: {
    accessToken: string;
    metaAdAccountId: string;
    level: 'adset' | 'ad';
    idField: 'adset.id' | 'ad.id';
    idKey: 'adset_id' | 'ad_id';
    ids: string[];
    from: string;
    to: string;
  }): Promise<
    {
      id: string;
      date: string;
      impressions: string;
      clicks: string;
      spendCents: string;
      conversions: string;
      reach: string;
      frequency: number;
      cpmCents: string | null;
      ctr: number | null;
    }[]
  > {
    const url = new URL(`${GRAPH_BASE}/${opts.metaAdAccountId}/insights`);
    url.searchParams.set('level', opts.level);
    url.searchParams.set('time_increment', '1');
    url.searchParams.set('time_range', JSON.stringify({ since: opts.from, until: opts.to }));
    url.searchParams.set(
      'filtering',
      JSON.stringify([{ field: opts.idField, operator: 'IN', value: opts.ids }]),
    );
    url.searchParams.set(
      'fields',
      [
        opts.idKey,
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
    url.searchParams.set('access_token', opts.accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_insights_fetch_failed');
    const body = (await res.json()) as {
      data: Record<string, string | undefined>[];
    };
    return body.data.map((row) => ({
      id: String(row[opts.idKey] ?? ''),
      date: String(row['date_start'] ?? ''),
      impressions: row['impressions'] ?? '0',
      clicks: row['clicks'] ?? '0',
      spendCents: toMinorUnits(row['spend'] ?? '0'),
      conversions: row['conversions'] ?? '0',
      reach: row['reach'] ?? '0',
      frequency: row['frequency'] !== undefined ? Number(row['frequency']) : 0,
      cpmCents: row['cpm'] !== undefined ? toMinorUnits(row['cpm']) : null,
      ctr: row['ctr'] !== undefined ? Number(row['ctr']) : null,
    }));
  }

  async createCampaign(input: CreateCampaignInput): Promise<MetaCampaignSnapshot> {
    const body = new URLSearchParams({
      name: input.name,
      objective: input.objective,
      status: input.status,
      access_token: input.accessToken,
    });
    if (input.dailyBudgetCents !== undefined) body.set('daily_budget', input.dailyBudgetCents);
    if (input.lifetimeBudgetCents !== undefined)
      body.set('lifetime_budget', input.lifetimeBudgetCents);
    if (input.startTime !== undefined) body.set('start_time', input.startTime);
    if (input.endTime !== undefined) body.set('stop_time', input.endTime);
    body.set('special_ad_categories', '[]');

    const res = await fetch(`${GRAPH_BASE}/${input.metaAdAccountId}/campaigns`, {
      method: 'POST',
      body,
    });
    if (!res.ok) throw new BadGatewayException('meta_campaign_create_failed');
    const { id } = (await res.json()) as { id: string };
    // Graph's create response only returns the id. Fetch the freshly
    // persisted row so the caller gets a full snapshot to cache.
    const detail = await this.fetchCampaignById(input.accessToken, id);
    return detail;
  }

  async updateCampaign(input: UpdateCampaignInput): Promise<MetaCampaignSnapshot> {
    const body = new URLSearchParams({ access_token: input.accessToken });
    if (input.name !== undefined) body.set('name', input.name);
    if (input.status !== undefined) body.set('status', input.status);
    if (input.dailyBudgetCents !== undefined) {
      body.set('daily_budget', input.dailyBudgetCents ?? '');
    }
    if (input.lifetimeBudgetCents !== undefined) {
      body.set('lifetime_budget', input.lifetimeBudgetCents ?? '');
    }
    if (input.endTime !== undefined) body.set('stop_time', input.endTime ?? '');

    const res = await fetch(`${GRAPH_BASE}/${input.metaCampaignId}`, { method: 'POST', body });
    if (!res.ok) throw new BadGatewayException('meta_campaign_update_failed');
    return this.fetchCampaignById(input.accessToken, input.metaCampaignId);
  }

  async deleteCampaign(input: DeleteCampaignInput): Promise<void> {
    const url = new URL(`${GRAPH_BASE}/${input.metaCampaignId}`);
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new BadGatewayException('meta_campaign_delete_failed');
  }

  private async fetchCampaignById(
    accessToken: string,
    metaCampaignId: string,
  ): Promise<MetaCampaignSnapshot> {
    const url = new URL(`${GRAPH_BASE}/${metaCampaignId}`);
    url.searchParams.set(
      'fields',
      'id,name,objective,status,daily_budget,lifetime_budget,currency,start_time,stop_time',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_campaign_fetch_failed');
    const c = (await res.json()) as {
      id: string;
      name: string;
      objective?: string;
      status?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      currency?: string;
      start_time?: string;
      stop_time?: string;
    };
    return {
      metaCampaignId: c.id,
      name: c.name,
      objective: c.objective ?? null,
      status: normaliseCampaignStatus(c.status),
      dailyBudgetCents: c.daily_budget ?? null,
      lifetimeBudgetCents: c.lifetime_budget ?? null,
      currency: c.currency ?? null,
      startTime: c.start_time ?? null,
      endTime: c.stop_time ?? null,
    };
  }

  async fetchAdSets(input: FetchAdSetsInput): Promise<MetaAdSetSnapshot[]> {
    const url = new URL(`${GRAPH_BASE}/${input.metaCampaignId}/adsets`);
    url.searchParams.set(
      'fields',
      [
        'id',
        'name',
        'status',
        'optimization_goal',
        'billing_event',
        'daily_budget',
        'lifetime_budget',
        'start_time',
        'end_time',
        'targeting',
      ].join(','),
    );
    url.searchParams.set('limit', '250');
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_adsets_fetch_failed');
    const body = (await res.json()) as { data: RawAdSet[] };
    return body.data.map(toAdSetSnapshot);
  }

  async createAdSet(input: CreateAdSetInput): Promise<MetaAdSetSnapshot> {
    // Ad sets are created under the ad account, not the campaign. We need the
    // ad_account_id; the quickest way is to ask the campaign for it.
    const campaignRes = await fetch(
      `${GRAPH_BASE}/${input.metaCampaignId}?fields=account_id&access_token=${input.accessToken}`,
    );
    if (!campaignRes.ok) throw new BadGatewayException('meta_campaign_fetch_failed');
    const { account_id } = (await campaignRes.json()) as { account_id: string };

    const body = new URLSearchParams({
      name: input.name,
      status: input.status,
      optimization_goal: input.optimizationGoal,
      billing_event: input.billingEvent,
      campaign_id: input.metaCampaignId,
      access_token: input.accessToken,
    });
    if (input.dailyBudgetCents !== undefined) body.set('daily_budget', input.dailyBudgetCents);
    if (input.lifetimeBudgetCents !== undefined)
      body.set('lifetime_budget', input.lifetimeBudgetCents);
    if (input.startTime !== undefined) body.set('start_time', input.startTime);
    if (input.endTime !== undefined) body.set('end_time', input.endTime);
    if (input.targeting !== undefined) body.set('targeting', JSON.stringify(input.targeting));

    const res = await fetch(`${GRAPH_BASE}/act_${account_id}/adsets`, { method: 'POST', body });
    if (!res.ok) throw new BadGatewayException('meta_adset_create_failed');
    const { id } = (await res.json()) as { id: string };
    return this.fetchAdSetById(input.accessToken, id);
  }

  async updateAdSet(input: UpdateAdSetInput): Promise<MetaAdSetSnapshot> {
    const body = new URLSearchParams({ access_token: input.accessToken });
    if (input.name !== undefined) body.set('name', input.name);
    if (input.status !== undefined) body.set('status', input.status);
    if (input.dailyBudgetCents !== undefined)
      body.set('daily_budget', input.dailyBudgetCents ?? '');
    if (input.lifetimeBudgetCents !== undefined) {
      body.set('lifetime_budget', input.lifetimeBudgetCents ?? '');
    }
    if (input.endTime !== undefined) body.set('end_time', input.endTime ?? '');
    if (input.targeting !== undefined) body.set('targeting', JSON.stringify(input.targeting));

    const res = await fetch(`${GRAPH_BASE}/${input.metaAdSetId}`, { method: 'POST', body });
    if (!res.ok) throw new BadGatewayException('meta_adset_update_failed');
    return this.fetchAdSetById(input.accessToken, input.metaAdSetId);
  }

  async deleteAdSet(input: DeleteAdSetInput): Promise<void> {
    const url = new URL(`${GRAPH_BASE}/${input.metaAdSetId}`);
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new BadGatewayException('meta_adset_delete_failed');
  }

  private async fetchAdSetById(
    accessToken: string,
    metaAdSetId: string,
  ): Promise<MetaAdSetSnapshot> {
    const url = new URL(`${GRAPH_BASE}/${metaAdSetId}`);
    url.searchParams.set(
      'fields',
      'id,name,status,optimization_goal,billing_event,daily_budget,lifetime_budget,start_time,end_time,targeting',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_adset_fetch_failed');
    return toAdSetSnapshot((await res.json()) as RawAdSet);
  }

  async fetchAds(input: FetchAdsInput): Promise<MetaAdSnapshot[]> {
    const url = new URL(`${GRAPH_BASE}/${input.metaAdSetId}/ads`);
    url.searchParams.set('fields', 'id,name,status,effective_status,creative{id}');
    url.searchParams.set('limit', '250');
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_ads_fetch_failed');
    const body = (await res.json()) as { data: RawAd[] };
    return body.data.map(toAdSnapshot);
  }

  async createAd(input: CreateAdInput): Promise<MetaAdSnapshot> {
    const adsetRes = await fetch(
      `${GRAPH_BASE}/${input.metaAdSetId}?fields=account_id&access_token=${input.accessToken}`,
    );
    if (!adsetRes.ok) throw new BadGatewayException('meta_adset_fetch_failed');
    const { account_id } = (await adsetRes.json()) as { account_id: string };

    const body = new URLSearchParams({
      name: input.name,
      status: input.status,
      adset_id: input.metaAdSetId,
      creative: JSON.stringify({ creative_id: input.metaCreativeId }),
      access_token: input.accessToken,
    });
    const res = await fetch(`${GRAPH_BASE}/act_${account_id}/ads`, { method: 'POST', body });
    if (!res.ok) throw new BadGatewayException('meta_ad_create_failed');
    const { id } = (await res.json()) as { id: string };
    return this.fetchAdById(input.accessToken, id);
  }

  async updateAd(input: UpdateAdInput): Promise<MetaAdSnapshot> {
    const body = new URLSearchParams({ access_token: input.accessToken });
    if (input.name !== undefined) body.set('name', input.name);
    if (input.status !== undefined) body.set('status', input.status);
    if (input.metaCreativeId !== undefined) {
      body.set('creative', JSON.stringify({ creative_id: input.metaCreativeId }));
    }
    const res = await fetch(`${GRAPH_BASE}/${input.metaAdId}`, { method: 'POST', body });
    if (!res.ok) throw new BadGatewayException('meta_ad_update_failed');
    return this.fetchAdById(input.accessToken, input.metaAdId);
  }

  async deleteAd(input: DeleteAdInput): Promise<void> {
    const url = new URL(`${GRAPH_BASE}/${input.metaAdId}`);
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new BadGatewayException('meta_ad_delete_failed');
  }

  private async fetchAdById(accessToken: string, metaAdId: string): Promise<MetaAdSnapshot> {
    const url = new URL(`${GRAPH_BASE}/${metaAdId}`);
    url.searchParams.set('fields', 'id,name,status,effective_status,creative{id}');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_ad_fetch_failed');
    return toAdSnapshot((await res.json()) as RawAd);
  }

  async fetchCreatives(input: FetchCreativesInput): Promise<MetaCreativeSnapshot[]> {
    const url = new URL(`${GRAPH_BASE}/${input.metaAdAccountId}/adcreatives`);
    url.searchParams.set(
      'fields',
      'id,name,object_type,thumbnail_url,image_url,video_id,object_story_spec',
    );
    url.searchParams.set('limit', '250');
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_creatives_fetch_failed');
    const body = (await res.json()) as { data: RawCreative[] };
    return body.data.map(toCreativeSnapshot);
  }

  async createCreative(input: CreateCreativeInput): Promise<MetaCreativeSnapshot> {
    const body = new URLSearchParams({
      name: input.name,
      access_token: input.accessToken,
    });
    if (input.objectStorySpec !== undefined) {
      body.set('object_story_spec', JSON.stringify(input.objectStorySpec));
    }
    const res = await fetch(`${GRAPH_BASE}/${input.metaAdAccountId}/adcreatives`, {
      method: 'POST',
      body,
    });
    if (!res.ok) throw new BadGatewayException('meta_creative_create_failed');
    const { id } = (await res.json()) as { id: string };
    return this.fetchCreativeById(input.accessToken, id);
  }

  async deleteCreative(input: DeleteCreativeInput): Promise<void> {
    const url = new URL(`${GRAPH_BASE}/${input.metaCreativeId}`);
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new BadGatewayException('meta_creative_delete_failed');
  }

  private async fetchCreativeById(
    accessToken: string,
    metaCreativeId: string,
  ): Promise<MetaCreativeSnapshot> {
    const url = new URL(`${GRAPH_BASE}/${metaCreativeId}`);
    url.searchParams.set(
      'fields',
      'id,name,object_type,thumbnail_url,image_url,video_id,object_story_spec',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    if (!res.ok) throw new BadGatewayException('meta_creative_fetch_failed');
    return toCreativeSnapshot((await res.json()) as RawCreative);
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

interface RawAdSet {
  id: string;
  name: string;
  status?: string;
  optimization_goal?: string;
  billing_event?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  targeting?: unknown;
}

function toAdSetSnapshot(s: RawAdSet): MetaAdSetSnapshot {
  return {
    metaAdSetId: s.id,
    name: s.name,
    status: normaliseAdSetStatus(s.status),
    optimizationGoal: s.optimization_goal ?? null,
    billingEvent: s.billing_event ?? null,
    dailyBudgetCents: s.daily_budget ?? null,
    lifetimeBudgetCents: s.lifetime_budget ?? null,
    startTime: s.start_time ?? null,
    endTime: s.end_time ?? null,
    targeting: s.targeting ?? null,
  };
}

function normaliseAdSetStatus(raw: string | undefined): MetaAdSetStatus {
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

interface RawAd {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  creative?: { id?: string };
}

function toAdSnapshot(a: RawAd): MetaAdSnapshot {
  return {
    metaAdId: a.id,
    name: a.name,
    status: normaliseAdStatus(a.status),
    effectiveStatus: a.effective_status ?? null,
    metaCreativeId: a.creative?.id ?? null,
  };
}

function normaliseAdStatus(raw: string | undefined): MetaAdStatus {
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

interface RawCreative {
  id: string;
  name?: string;
  object_type?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  object_story_spec?: unknown;
}

function toCreativeSnapshot(c: RawCreative): MetaCreativeSnapshot {
  return {
    metaCreativeId: c.id,
    name: c.name ?? `creative_${c.id}`,
    kind: normaliseCreativeKind(c.object_type, c.video_id !== undefined),
    thumbUrl: c.thumbnail_url ?? c.image_url ?? null,
    objectStorySpec: c.object_story_spec ?? null,
  };
}

function normaliseCreativeKind(
  objectType: string | undefined,
  hasVideo: boolean,
): MetaCreativeKind {
  switch ((objectType ?? '').toUpperCase()) {
    case 'VIDEO':
      return 'VIDEO';
    case 'PHOTO':
      return 'IMAGE';
    case 'SHARE':
      return 'LINK';
    case 'STATUS':
      return 'POST';
    case 'OFFER':
    case 'INVALID':
    default:
      return hasVideo ? 'VIDEO' : 'IMAGE';
  }
}
