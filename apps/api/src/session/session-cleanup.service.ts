import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Hourly cron that hard-deletes sessions either past their `expiresAt` OR
 * revoked more than 14 days ago. This keeps the table bounded and ensures
 * old refreshTokenHash entries can't linger forever.
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'session-cleanup' })
  async cleanup(): Promise<void> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: fourteenDaysAgo } }],
      },
    });
    if (count > 0) {
      this.logger.log(`pruned ${count.toString()} expired/revoked sessions`);
    }
  }
}
