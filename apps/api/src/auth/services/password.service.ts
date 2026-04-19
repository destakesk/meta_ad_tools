import bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { zxcvbnAsync, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';

import type { AppConfig } from '../../config/configuration.js';

export interface PasswordStrengthContext {
  password: string;
  email: string;
  fullName: string;
}

export interface PasswordStrengthResult {
  ok: boolean;
  score: number; // 0–4
  feedback: string | undefined;
}

/**
 * Password hashing + strength validation.
 *
 * Hashing: bcrypt with cost from config (default 12).
 * Strength: zxcvbn-ts score must be ≥3, AND password must not contain the
 * email local part or the user's full name as a substring (case-insensitive).
 * Common-password blacklist is provided by zxcvbn's dictionary.
 */
@Injectable()
export class PasswordService {
  private readonly cost: number;

  constructor(config: ConfigService<AppConfig, true>) {
    this.cost = config.get('auth', { infer: true }).bcryptCost;
    zxcvbnOptions.setOptions({
      dictionary: {
        ...zxcvbnCommon.dictionary,
        ...zxcvbnEn.dictionary,
      },
      graphs: zxcvbnCommon.adjacencyGraphs,
      translations: zxcvbnEn.translations,
    });
  }

  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.cost);
  }

  async compare(plaintext: string, hashed: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plaintext, hashed);
    } catch {
      return false;
    }
  }

  /**
   * Runs zxcvbn against the candidate password with user-specific "user inputs"
   * so the scorer penalises passwords containing the email or full name.
   */
  async validateStrength(ctx: PasswordStrengthContext): Promise<PasswordStrengthResult> {
    const emailLocal = ctx.email.split('@')[0] ?? '';
    const nameParts = ctx.fullName.trim().split(/\s+/).filter(Boolean);

    const lower = ctx.password.toLowerCase();
    if (emailLocal.length >= 3 && lower.includes(emailLocal.toLowerCase())) {
      return { ok: false, score: 0, feedback: 'Şifre email adresini içeremez' };
    }
    for (const part of nameParts) {
      if (part.length >= 3 && lower.includes(part.toLowerCase())) {
        return { ok: false, score: 0, feedback: 'Şifre adınızı içeremez' };
      }
    }

    const result = await zxcvbnAsync(ctx.password, [ctx.email, emailLocal, ...nameParts]);
    if (result.score < 3) {
      return {
        ok: false,
        score: result.score,
        feedback:
          result.feedback.warning ||
          result.feedback.suggestions[0] ||
          'Şifre çok zayıf, daha güçlü bir şifre seçin',
      };
    }
    return { ok: true, score: result.score, feedback: undefined };
  }
}
