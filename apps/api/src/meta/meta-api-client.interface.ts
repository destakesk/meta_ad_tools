/**
 * Module 03 — Meta Graph API client.
 *
 * The interface is provider-shaped (authorize url, code-for-token exchange,
 * profile lookup, ad-accounts list). Two implementations live in this module:
 *
 *   - MockMetaApiClient — used when META_OAUTH_MODE=mock (default in dev/CI).
 *     Hands out deterministic tokens and a small in-memory ad-account
 *     fixture so the rest of the system can be exercised without a real
 *     Meta app. Decoupled from network entirely.
 *
 *   - RealMetaApiClient — calls graph.facebook.com / facebook.com/dialog/oauth.
 *     Driven by META_APP_ID, META_APP_SECRET. Switched in via
 *     META_OAUTH_MODE=real once the Meta business app is approved.
 */

export interface MetaTokenSet {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresInSeconds: number | null;
  scopes: string[];
}

export interface MetaUserProfile {
  metaUserId: string;
  displayName: string;
}

export interface MetaAdAccountSnapshot {
  metaAdAccountId: string; // act_xxxxx
  name: string;
  currency: string;
  timezone: string | null;
  status: string | null;
}

export type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | 'UNKNOWN';

export interface MetaCampaignSnapshot {
  metaCampaignId: string;
  name: string;
  objective: string | null;
  status: MetaCampaignStatus;
  /** BigInt-safe string representation of minor units. */
  dailyBudgetCents: string | null;
  lifetimeBudgetCents: string | null;
  currency: string | null;
  startTime: string | null; // ISO 8601
  endTime: string | null;
}

export interface FetchCampaignsInput {
  accessToken: string;
  metaAdAccountId: string; // act_xxxxx
}

export interface MetaInsightSnapshot {
  metaCampaignId: string;
  date: string; // YYYY-MM-DD
  impressions: string; // BigInt-safe string
  clicks: string;
  spendCents: string;
  conversions: string;
  reach: string;
  frequency: number;
  cpmCents: string | null;
  ctr: number | null;
}

export interface FetchInsightsInput {
  accessToken: string;
  metaAdAccountId: string;
  metaCampaignIds: string[];
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export interface CreateCampaignInput {
  accessToken: string;
  metaAdAccountId: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED';
  /** Minor units, BigInt-safe string. Exactly one must be provided. */
  dailyBudgetCents?: string;
  lifetimeBudgetCents?: string;
  startTime?: string;
  endTime?: string;
}

export interface UpdateCampaignInput {
  accessToken: string;
  metaCampaignId: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  dailyBudgetCents?: string | null;
  lifetimeBudgetCents?: string | null;
  endTime?: string | null;
}

export interface DeleteCampaignInput {
  accessToken: string;
  metaCampaignId: string;
}

export type MetaAdSetStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | 'UNKNOWN';

export interface MetaAdSetSnapshot {
  metaAdSetId: string;
  name: string;
  status: MetaAdSetStatus;
  optimizationGoal: string | null;
  billingEvent: string | null;
  dailyBudgetCents: string | null;
  lifetimeBudgetCents: string | null;
  startTime: string | null;
  endTime: string | null;
  targeting: unknown;
}

export interface FetchAdSetsInput {
  accessToken: string;
  metaCampaignId: string;
}

export interface CreateAdSetInput {
  accessToken: string;
  metaCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  optimizationGoal: string;
  billingEvent: string;
  dailyBudgetCents?: string;
  lifetimeBudgetCents?: string;
  startTime?: string;
  endTime?: string;
  targeting?: unknown;
}

export interface UpdateAdSetInput {
  accessToken: string;
  metaAdSetId: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  dailyBudgetCents?: string | null;
  lifetimeBudgetCents?: string | null;
  endTime?: string | null;
  targeting?: unknown;
}

export interface DeleteAdSetInput {
  accessToken: string;
  metaAdSetId: string;
}

export interface AuthorizeUrlInput {
  state: string;
  redirectUri: string;
  scopes: readonly string[];
}

export interface ExchangeCodeInput {
  code: string;
  redirectUri: string;
}

export interface MetaApiClient {
  /** Build the URL we redirect the user to in order to start consent. */
  buildAuthorizeUrl(input: AuthorizeUrlInput): string;

  /** Trade an OAuth code for an access token (and refresh, if available). */
  exchangeCode(input: ExchangeCodeInput): Promise<MetaTokenSet>;

  /** Refresh / extend an existing access token. Throws if no path forward. */
  rotate(token: MetaTokenSet): Promise<MetaTokenSet>;

  /** Look up the connected user's profile (for displayName + metaUserId). */
  fetchProfile(accessToken: string): Promise<MetaUserProfile>;

  /** List ad accounts visible to this access token. */
  fetchAdAccounts(accessToken: string): Promise<MetaAdAccountSnapshot[]>;

  /** List campaigns under an ad account. Cached into `campaigns` table. */
  fetchCampaigns(input: FetchCampaignsInput): Promise<MetaCampaignSnapshot[]>;

  /** Daily insights rows for a set of campaigns. Cached into `meta_insight_snapshots`. */
  fetchInsights(input: FetchInsightsInput): Promise<MetaInsightSnapshot[]>;

  /** Create a campaign on Meta. Returns the freshly-created snapshot. */
  createCampaign(input: CreateCampaignInput): Promise<MetaCampaignSnapshot>;

  /** Update an existing campaign. Returns the latest snapshot. */
  updateCampaign(input: UpdateCampaignInput): Promise<MetaCampaignSnapshot>;

  /** Delete (flip status to DELETED on Meta's side). */
  deleteCampaign(input: DeleteCampaignInput): Promise<void>;

  /** List ad sets under a campaign. Cached into `ad_sets`. */
  fetchAdSets(input: FetchAdSetsInput): Promise<MetaAdSetSnapshot[]>;

  /** Create an ad set under a campaign. Returns the fresh snapshot. */
  createAdSet(input: CreateAdSetInput): Promise<MetaAdSetSnapshot>;

  /** Update an existing ad set. Returns the latest snapshot. */
  updateAdSet(input: UpdateAdSetInput): Promise<MetaAdSetSnapshot>;

  /** Delete (flip status to DELETED on Meta's side). */
  deleteAdSet(input: DeleteAdSetInput): Promise<void>;

  /**
   * Best-effort token revocation on Meta's side. The local row is always
   * marked REVOKED regardless of whether this succeeds.
   */
  revoke(accessToken: string): Promise<void>;
}

export const META_API_CLIENT = Symbol('META_API_CLIENT');
