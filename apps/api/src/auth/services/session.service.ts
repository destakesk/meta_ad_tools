import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UAParser } from 'ua-parser-js';

import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

import type { Session } from '@metaflow/database';
import type { AppConfig } from '../../config/configuration.js';
import type { RevokedReason } from '@metaflow/shared-types';

/**
 * Session lifecycle: create, rotate (with theft detection), revoke, list.
 *
 * Refresh tokens are stored as SHA-256 hashes and indexed — lookup is a single
 * O(log N) query. Rotation is atomic per `findFirst + update where revokedAt
 * is null`; if the same plaintext refresh is presented twice, only one rotation
 * succeeds — the losing request triggers `revokeAllForUser(…, 'theft_detected')`.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.refreshTtlMs = config.get('auth', { infer: true }).refreshTokenTtlSeconds * 1000;
  }

  async create(input: {
    userId: string;
    userAgent: string | undefined;
    ipAddress: string | undefined;
  }): Promise<{ session: Session; refreshToken: string }> {
    const refreshToken = this.tokens.generateOpaqueToken();
    const refreshTokenHash = this.tokens.hashOpaqueToken(refreshToken);
    const device = this.parseDevice(input.userAgent);

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        device,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return { session, refreshToken };
  }

  /**
   * Validates + rotates a refresh token. Returns the NEW session row + new
   * refresh token plaintext. Throws if the token is unknown, revoked, expired,
   * or reuse is detected.
   */
  async rotate(presentedRefresh: string): Promise<{
    session: Session;
    refreshToken: string;
  }> {
    const hash = this.tokens.hashOpaqueToken(presentedRefresh);
    const existing = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
    });

    if (!existing) {
      throw new Error('refresh_token_unknown');
    }
    if (existing.revokedAt) {
      // Token theft suspected — a previously-rotated token is being replayed.
      this.logger.warn(
        `refresh token replay detected for user ${existing.userId}; revoking all sessions`,
      );
      await this.revokeAllForUser(existing.userId, 'theft_detected');
      throw new Error('refresh_token_replay');
    }
    if (existing.expiresAt.getTime() < Date.now()) {
      await this.prisma.session.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), revokedReason: 'expired_cleanup' satisfies RevokedReason },
      });
      throw new Error('refresh_token_expired');
    }

    const newRefresh = this.tokens.generateOpaqueToken();
    const newHash = this.tokens.hashOpaqueToken(newRefresh);

    const [, newSession] = await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'rotation' satisfies RevokedReason,
        },
      }),
      this.prisma.session.create({
        data: {
          userId: existing.userId,
          refreshTokenHash: newHash,
          userAgent: existing.userAgent,
          ipAddress: existing.ipAddress,
          device: existing.device,
          expiresAt: new Date(Date.now() + this.refreshTtlMs),
        },
      }),
    ]);

    return { session: newSession, refreshToken: newRefresh };
  }

  async touch(sessionId: string): Promise<void> {
    await this.prisma.session
      .update({ where: { id: sessionId }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  async revoke(sessionId: string, reason: RevokedReason): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: RevokedReason,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async listForUser(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async isActive(sessionId: string): Promise<boolean> {
    const row = await this.prisma.session.findUnique({ where: { id: sessionId } });
    return !!row && row.revokedAt === null && row.expiresAt.getTime() > Date.now();
  }

  private parseDevice(userAgent: string | undefined): string | null {
    if (!userAgent) return null;
    try {
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser().name ?? 'unknown';
      const os = parser.getOS().name ?? 'unknown';
      return `${browser} on ${os}`;
    } catch {
      return null;
    }
  }
}
