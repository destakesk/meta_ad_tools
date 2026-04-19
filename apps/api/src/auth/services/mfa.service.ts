import { randomInt } from 'node:crypto';

import bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

import type { AppConfig } from '../../config/configuration.js';

// Crockford base32 excluding ambiguous I/L/O/U.
const BACKUP_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * TOTP authenticator + backup-code lifecycle.
 *
 * Clock-skew tolerance: ±30s (window: 1). Algorithm defaults to SHA-1 which
 * matches Google Authenticator / Authy / 1Password out of the box.
 */
@Injectable()
export class MfaService {
  private readonly issuer: string;
  private readonly bcryptCost: number;

  constructor(config: ConfigService<AppConfig, true>) {
    this.issuer = config.get('mfa', { infer: true }).issuer;
    this.bcryptCost = config.get('auth', { infer: true }).bcryptCost;
    authenticator.options = { window: 1, digits: 6, step: 30 };
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpAuthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, this.issuer, secret);
  }

  async generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return qrcode.toDataURL(otpAuthUrl, { errorCorrectionLevel: 'M', margin: 1 });
  }

  verifyTotp(code: string, secret: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  /**
   * Generates 10 backup codes of form XXXXX-XXXXX (10 chars Crockford base32
   * excluding ambiguous I/L/O/U). Returns the plaintext once plus their
   * bcrypt hashes ready to persist.
   */
  async generateBackupCodes(): Promise<{ plaintext: string[]; hashes: string[] }> {
    const plaintext: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      plaintext.push(this.generateOneCode());
    }
    const hashes = await Promise.all(plaintext.map((code) => bcrypt.hash(code, this.bcryptCost)));
    return { plaintext, hashes };
  }

  /**
   * Checks if `code` matches any un-used hash. Returns the INDEX of the matching
   * hash (for the caller to drop) or -1 if none match.
   */
  async verifyBackupCode(code: string, hashes: readonly string[]): Promise<number> {
    const normalised = code.trim().toUpperCase().replace(/\s+/g, '');
    for (let i = 0; i < hashes.length; i += 1) {
      const h = hashes[i];
      if (!h) continue;
      if (await bcrypt.compare(normalised, h)) return i;
    }
    return -1;
  }

  private generateOneCode(): string {
    const block = (): string => {
      let out = '';
      for (let i = 0; i < 5; i += 1) {
        out += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
      }
      return out;
    };
    return `${block()}-${block()}`;
  }
}
