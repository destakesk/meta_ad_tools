import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

import type { AppConfig } from '../../config/configuration.js';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
  jti: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface MfaTokenPayload {
  sub: string;
  type: 'mfa_setup' | 'mfa_challenge';
  iat: number;
  exp: number;
}

/**
 * JWT + opaque token factory.
 *
 *   - Access token: HS256 JWT, 15min, JWT_SECRET, { sub, sid, email, jti }.
 *   - MFA setup / challenge: HS256 JWT, 5min, MFA_TOKEN_SECRET (isolated from
 *     the access-token secret so a JWT_SECRET compromise doesn't bypass MFA).
 *   - Opaque token: 48-byte crypto-random base64url — used for refresh,
 *     email-verify, password-reset, and invitation tokens.
 *   - Opaque hash: SHA-256 hex. 256-bit random inputs — SHA-256 is fast and
 *     collision-safe at this entropy. Stored in DB, indexed, O(log N) lookup.
 */
@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly mfaSecret: string;
  private readonly accessTtl: number;
  private readonly mfaSetupTtl: number;
  private readonly mfaChallengeTtl: number;

  constructor(config: ConfigService<AppConfig, true>) {
    const auth = config.get('auth', { infer: true });
    const mfa = config.get('mfa', { infer: true });
    this.jwtSecret = auth.jwtSecret;
    this.mfaSecret = mfa.tokenSecret;
    this.accessTtl = auth.accessTokenTtlSeconds;
    this.mfaSetupTtl = mfa.setupTokenTtlSeconds;
    this.mfaChallengeTtl = mfa.challengeTokenTtlSeconds;
  }

  signAccessToken(input: { userId: string; sessionId: string; email: string }): {
    token: string;
    jti: string;
    expiresIn: number;
  } {
    const jti = randomUUID();
    const token = jwt.sign(
      { sub: input.userId, sid: input.sessionId, email: input.email, jti, type: 'access' },
      this.jwtSecret,
      { algorithm: 'HS256', expiresIn: this.accessTtl },
    );
    return { token, jti, expiresIn: this.accessTtl };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const payload = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload['type'] !== 'access') {
      throw new Error('invalid access token');
    }
    return payload as unknown as AccessTokenPayload;
  }

  signMfaToken(input: { userId: string; type: 'mfa_setup' | 'mfa_challenge' }): {
    token: string;
    expiresIn: number;
  } {
    const ttl = input.type === 'mfa_setup' ? this.mfaSetupTtl : this.mfaChallengeTtl;
    const token = jwt.sign({ sub: input.userId, type: input.type }, this.mfaSecret, {
      algorithm: 'HS256',
      expiresIn: ttl,
    });
    return { token, expiresIn: ttl };
  }

  verifyMfaToken(token: string, expectedType: 'mfa_setup' | 'mfa_challenge'): MfaTokenPayload {
    const payload = jwt.verify(token, this.mfaSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload['type'] !== expectedType) {
      throw new Error(`invalid ${expectedType} token`);
    }
    return payload as unknown as MfaTokenPayload;
  }

  /** 48-byte crypto-random token, base64url-encoded (64 chars). */
  generateOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  /** SHA-256 hex digest of an opaque token — stored + indexed in DB. */
  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
