import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@metaflow/database';

/**
 * Nest wrapper around the shared Prisma client.
 *
 * - Connects eagerly on module init so the first request does not pay the
 *   cold-start cost.
 * - Disconnects on module destroy so graceful shutdown releases the pool.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('prisma disconnected');
  }
}
