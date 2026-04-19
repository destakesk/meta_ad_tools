import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration.js';

/**
 * AES-256-GCM encrypt / decrypt with authenticated encryption and optional
 * additional authenticated data (AAD).
 *
 * Output format (base64 segments joined by `.`):
 *   v1.<iv>.<ciphertext>.<tag>
 *
 * Design choices:
 *   - 12-byte IV per NIST SP 800-38D recommendation for GCM.
 *   - 16-byte (128-bit) auth tag — GCM default.
 *   - A new random IV is generated for every encrypt; reuse would be a fatal
 *     cryptographic error for GCM.
 *   - AAD binds the ciphertext to a context string (e.g. user id), preventing
 *     ciphertext-swap attacks across records.
 *   - Version prefix (`v1.`) reserves room to rotate primitives without
 *     breaking already-stored data.
 */
@Injectable()
export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly VERSION = 'v1';
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  private readonly key: Buffer;

  constructor(config: ConfigService<AppConfig, true>) {
    const raw = config.get('encryption', { infer: true }).key;
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length !== 32) {
      throw new Error(`ENCRYPTION_KEY must decode to 32 bytes (got ${decoded.length.toString()})`);
    }
    this.key = decoded;
  }

  /**
   * Encrypts `plaintext` and returns `v1.<iv>.<ciphertext>.<tag>` (base64
   * segments). `aad` is optional context data bound into the auth tag.
   */
  encrypt(plaintext: string, aad?: string): string {
    const iv = randomBytes(CryptoService.IV_LENGTH);
    const cipher = createCipheriv(CryptoService.ALGORITHM, this.key, iv, {
      authTagLength: CryptoService.TAG_LENGTH,
    });
    if (aad !== undefined) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      CryptoService.VERSION,
      iv.toString('base64'),
      encrypted.toString('base64'),
      tag.toString('base64'),
    ].join('.');
  }

  /**
   * Decrypts a string produced by {@link encrypt}. Throws if:
   *   - The version prefix is unknown.
   *   - The ciphertext has been tampered with (auth tag mismatch).
   *   - The supplied `aad` differs from the one used at encrypt time.
   */
  decrypt(packed: string, aad?: string): string {
    const parts = packed.split('.');
    if (parts.length !== 4) {
      throw new Error('invalid ciphertext format');
    }
    const [version, ivB64, ctB64, tagB64] = parts;
    if (version !== CryptoService.VERSION) {
      throw new Error(`unsupported ciphertext version: ${version ?? '<empty>'}`);
    }
    if (!ivB64 || !ctB64 || !tagB64) {
      throw new Error('invalid ciphertext format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    if (iv.length !== CryptoService.IV_LENGTH) {
      throw new Error('invalid IV length');
    }
    if (tag.length !== CryptoService.TAG_LENGTH) {
      throw new Error('invalid auth tag length');
    }

    const decipher = createDecipheriv(CryptoService.ALGORITHM, this.key, iv, {
      authTagLength: CryptoService.TAG_LENGTH,
    });
    if (aad !== undefined) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Constant-time equality check — use this when comparing two base64 tokens
   * (e.g. CSRF tokens, webhook signatures) to avoid timing side channels.
   */
  static constantTimeEquals(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
