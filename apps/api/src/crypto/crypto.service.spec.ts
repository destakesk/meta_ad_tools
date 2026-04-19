import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';

import { CryptoService } from './crypto.service.js';

function makeConfig(keyB64: string): ConfigService {
  return {
    get: (_path: string, _opts?: unknown) => ({ key: keyB64 }),
  } as unknown as ConfigService;
}

const keyA = randomBytes(32).toString('base64');
const keyB = randomBytes(32).toString('base64');

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService(makeConfig(keyA));
  });

  it('encrypts and decrypts a round-trip', () => {
    const plaintext = 'meta_bisu_token_example_12345';
    const packed = service.encrypt(plaintext);
    expect(packed.startsWith('v1.')).toBe(true);
    expect(service.decrypt(packed)).toBe(plaintext);
  });

  it('produces a unique IV per encryption (1000 iterations)', () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const packed = service.encrypt('hello');
      const parts = packed.split('.');
      ivs.add(parts[1] ?? '');
    }
    expect(ivs.size).toBe(1000);
  });

  it('fails to decrypt when ciphertext is tampered', () => {
    const packed = service.encrypt('secret');
    const parts = packed.split('.');
    const ct = Buffer.from(parts[2] ?? '', 'base64');
    ct[0] = (ct[0] ?? 0) ^ 0xff;
    const tampered = `${parts[0]}.${parts[1]}.${ct.toString('base64')}.${parts[3]}`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('fails to decrypt with a different key', () => {
    const packed = service.encrypt('secret');
    const other = new CryptoService(makeConfig(keyB));
    expect(() => other.decrypt(packed)).toThrow();
  });

  it('binds AAD — decrypt with wrong AAD fails', () => {
    const packed = service.encrypt('secret', 'user-123');
    expect(service.decrypt(packed, 'user-123')).toBe('secret');
    expect(() => service.decrypt(packed, 'user-456')).toThrow();
    expect(() => service.decrypt(packed)).toThrow();
  });

  it('rejects unknown version prefix', () => {
    const packed = service.encrypt('secret');
    const parts = packed.split('.');
    const bad = `v2.${parts[1]}.${parts[2]}.${parts[3]}`;
    expect(() => service.decrypt(bad)).toThrow(/version/);
  });

  it('rejects malformed ciphertext', () => {
    expect(() => service.decrypt('not-a-packed-string')).toThrow();
    expect(() => service.decrypt('v1..ct.tag')).toThrow();
  });

  it('rejects key that does not decode to 32 bytes', () => {
    const shortKey = Buffer.from('too-short').toString('base64');
    expect(() => new CryptoService(makeConfig(shortKey))).toThrow(/32 bytes/);
  });

  it('constantTimeEquals returns true only for exact match', () => {
    expect(CryptoService.constantTimeEquals('abc', 'abc')).toBe(true);
    expect(CryptoService.constantTimeEquals('abc', 'abd')).toBe(false);
    expect(CryptoService.constantTimeEquals('abc', 'abcd')).toBe(false);
  });
});
