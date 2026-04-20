import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import type {
  AuthorizeUrlInput,
  ExchangeCodeInput,
  MetaAdAccountSnapshot,
  MetaApiClient,
  MetaTokenSet,
  MetaUserProfile,
} from './meta-api-client.interface.js';

/**
 * Deterministic-enough Meta API stub for dev / CI. The authorize URL points
 * back at our own /meta/connect/callback, the "code" we accept is anything
 * non-empty, and the tokens we hand out are random base64. Profile and
 * ad-account fixtures are stable across calls so UI snapshots don't drift.
 */
@Injectable()
export class MockMetaApiClient implements MetaApiClient {
  private readonly logger = new Logger(MockMetaApiClient.name);

  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    // Mock provider redirects right back to our callback with a fake code,
    // simulating the user clicking "Allow" on facebook.com.
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

  revoke(_accessToken: string): Promise<void> {
    this.logger.debug('mock revoke — nothing to call');
    return Promise.resolve();
  }
}
