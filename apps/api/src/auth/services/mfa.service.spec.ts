import { authenticator } from 'otplib';
import { beforeEach, describe, expect, it } from 'vitest';

import { MfaService } from './mfa.service.js';

import type { AppConfig } from '../../config/configuration.js';
import type { ConfigService } from '@nestjs/config';

type TestConfig = ConfigService<AppConfig, true>;

function makeConfig(): TestConfig {
  return {
    get: (key: string) =>
      key === 'mfa'
        ? {
            issuer: 'Metaflow',
            setupTokenTtlSeconds: 300,
            challengeTokenTtlSeconds: 300,
            disableAllowed: false,
            tokenSecret: 'x',
          }
        : {
            bcryptCost: 4,
            jwtSecret: 'x',
            accessTokenTtlSeconds: 900,
            refreshTokenTtlSeconds: 604800,
            passwordResetTtlSeconds: 3600,
            emailVerifyTtlSeconds: 86400,
            invitationTtlSeconds: 604800,
          },
  } as unknown as TestConfig;
}

describe('MfaService', () => {
  let svc: MfaService;

  beforeEach(() => {
    svc = new MfaService(makeConfig());
  });

  it('generates a valid base32 TOTP secret', () => {
    const secret = svc.generateSecret();
    expect(secret.length).toBeGreaterThan(10);
  });

  it('buildOtpAuthUrl produces an otpauth URL with issuer + label', () => {
    const secret = svc.generateSecret();
    const url = svc.buildOtpAuthUrl('alice@example.com', secret);
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('issuer=Metaflow');
    expect(url).toContain(encodeURIComponent(secret));
  });

  it('verifyTotp accepts the current code', () => {
    const secret = svc.generateSecret();
    const code = authenticator.generate(secret);
    expect(svc.verifyTotp(code, secret)).toBe(true);
  });

  it('verifyTotp rejects wrong codes and malformed inputs', () => {
    const secret = svc.generateSecret();
    expect(svc.verifyTotp('000000', secret)).toBe(false);
    expect(svc.verifyTotp('abcdef', secret)).toBe(false);
    expect(svc.verifyTotp('', secret)).toBe(false);
    expect(svc.verifyTotp('1234567', secret)).toBe(false);
  });

  it('generateBackupCodes returns 10 unique XXXXX-XXXXX codes + bcrypt hashes', async () => {
    const { plaintext, hashes } = await svc.generateBackupCodes();
    expect(plaintext.length).toBe(10);
    expect(new Set(plaintext).size).toBe(10);
    expect(hashes.length).toBe(10);
    for (const code of plaintext) {
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    }
  });

  it('verifyBackupCode finds the matching hash index and rejects mismatches', async () => {
    const { plaintext, hashes } = await svc.generateBackupCodes();
    const idx = await svc.verifyBackupCode(plaintext[3]!, hashes);
    expect(idx).toBe(3);
    expect(await svc.verifyBackupCode('XXXXX-XXXXX', hashes)).toBe(-1);
  });

  it('verifyBackupCode normalises case and spaces', async () => {
    const { plaintext, hashes } = await svc.generateBackupCodes();
    const original = plaintext[0]!;
    const messy = original.toLowerCase().replace('-', ' - ');
    const idx = await svc.verifyBackupCode(messy, hashes);
    expect(idx).toBe(0);
  });
});
