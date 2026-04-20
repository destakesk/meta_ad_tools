import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { TokenService } from './token.service.js';

import type { AppConfig } from '../../config/configuration.js';
import type { ConfigService } from '@nestjs/config';

type TestConfig = ConfigService<AppConfig, true>;

const jwtSecret = randomBytes(32).toString('base64');
const mfaSecret = randomBytes(32).toString('base64');

function makeConfig(): TestConfig {
  return {
    get: (key: string) =>
      key === 'auth'
        ? {
            jwtSecret,
            accessTokenTtlSeconds: 900,
            refreshTokenTtlSeconds: 604800,
            bcryptCost: 4,
            passwordResetTtlSeconds: 3600,
            emailVerifyTtlSeconds: 86400,
            invitationTtlSeconds: 604800,
          }
        : {
            tokenSecret: mfaSecret,
            issuer: 'Metaflow',
            setupTokenTtlSeconds: 300,
            challengeTokenTtlSeconds: 300,
            disableAllowed: false,
          },
  } as unknown as TestConfig;
}

describe('TokenService', () => {
  let svc: TokenService;

  beforeEach(() => {
    svc = new TokenService(makeConfig());
  });

  it('signs + verifies an access token round-trip', () => {
    const { token, jti } = svc.signAccessToken({
      userId: 'u1',
      sessionId: 's1',
      email: 'a@b.c',
    });
    const payload = svc.verifyAccessToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.sid).toBe('s1');
    expect(payload.email).toBe('a@b.c');
    expect(payload.jti).toBe(jti);
    expect(payload.type).toBe('access');
  });

  it('rejects a tampered access token', () => {
    const { token } = svc.signAccessToken({ userId: 'u1', sessionId: 's1', email: 'a@b.c' });
    const bad = `${token.slice(0, -1)}X`;
    expect(() => svc.verifyAccessToken(bad)).toThrow();
  });

  it('signs + verifies mfa_setup and mfa_challenge tokens, but not cross-type', () => {
    const setup = svc.signMfaToken({ userId: 'u1', type: 'mfa_setup' });
    const challenge = svc.signMfaToken({ userId: 'u1', type: 'mfa_challenge' });
    expect(svc.verifyMfaToken(setup.token, 'mfa_setup').sub).toBe('u1');
    expect(svc.verifyMfaToken(challenge.token, 'mfa_challenge').sub).toBe('u1');
    expect(() => svc.verifyMfaToken(setup.token, 'mfa_challenge')).toThrow();
    expect(() => svc.verifyMfaToken(challenge.token, 'mfa_setup')).toThrow();
  });

  it('opaque tokens are 64 url-safe chars and unique', () => {
    const a = svc.generateOpaqueToken();
    const b = svc.generateOpaqueToken();
    expect(a.length).toBe(64);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashOpaqueToken produces a 64-char hex digest and is deterministic', () => {
    const t = svc.generateOpaqueToken();
    const h1 = svc.hashOpaqueToken(t);
    const h2 = svc.hashOpaqueToken(t);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});
