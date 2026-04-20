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

  /**
   * Best-effort token revocation on Meta's side. The local row is always
   * marked REVOKED regardless of whether this succeeds.
   */
  revoke(accessToken: string): Promise<void>;
}

export const META_API_CLIENT = Symbol('META_API_CLIENT');
