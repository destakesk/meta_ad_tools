import { beforeEach, describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import { PasswordService } from './password.service.js';
import type { AppConfig } from '../../config/configuration.js';

type TestConfig = ConfigService<AppConfig, true>;

function makeConfig(): TestConfig {
  return {
    get: (_key: string, _opts?: unknown) => ({
      bcryptCost: 4, // speed up tests
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604800,
      passwordResetTtlSeconds: 3600,
      emailVerifyTtlSeconds: 86400,
      invitationTtlSeconds: 604800,
      jwtSecret: 'x',
    }),
  } as unknown as TestConfig;
}

describe('PasswordService', () => {
  let svc: PasswordService;

  beforeEach(() => {
    svc = new PasswordService(makeConfig());
  });

  it('hashes and compares a password', async () => {
    const h = await svc.hash('Sup3rSecurePassW0rd');
    expect(h).not.toBe('Sup3rSecurePassW0rd');
    expect(await svc.compare('Sup3rSecurePassW0rd', h)).toBe(true);
    expect(await svc.compare('wrong', h)).toBe(false);
  });

  it('rejects a password containing the email local part', async () => {
    const r = await svc.validateStrength({
      password: 'alice2026StrongA',
      email: 'alice@example.com',
      fullName: 'Alice Kent',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects a password containing the user name', async () => {
    const r = await svc.validateStrength({
      password: 'KentForever2026!x',
      email: 'u@example.com',
      fullName: 'Alice Kent',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects low-entropy / common passwords', async () => {
    const r = await svc.validateStrength({
      password: 'Passw0rd1234',
      email: 'u@example.com',
      fullName: 'Bob Builder',
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a strong unrelated password', async () => {
    const r = await svc.validateStrength({
      password: 'tidepool-fjord-47-kite-zap',
      email: 'u@example.com',
      fullName: 'Bob Builder',
    });
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
});
