import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

import type { AppConfig } from '../../config/configuration.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../services/token.service.js';
import type { Request } from 'express';

function extractFromCookie(req: Request): string | null {
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  return cookies?.['metaflow_access'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('auth', { infer: true }).jwtSecret,
      algorithms: ['HS256'],
      passReqToCallback: false,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    if (payload.type !== 'access') throw new UnauthorizedException('invalid_token_type');

    // Revocation check: logout / password change writes the jti to Redis.
    const blacklisted = await this.redis.client.exists(`access_blacklist:${payload.jti}`);
    if (blacklisted) throw new UnauthorizedException('token_revoked');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, emailVerifiedAt: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('user_not_found');

    return {
      userId: user.id,
      sessionId: payload.sid,
      email: user.email,
      jti: payload.jti,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
