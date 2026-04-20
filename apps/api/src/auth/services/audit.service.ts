import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import type { AuditAction, AuditMetadata } from '@metaflow/shared-types';
import type { Queue } from 'bullmq';

export const AUDIT_QUEUE = 'audit-queue';

export interface AuditEvent {
  action: AuditAction;
  userId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Fire-and-forget audit logging. Events are pushed to the BullMQ `audit-queue`
 * where `AuditProcessor` writes them to `audit_logs`. If the queue is
 * unavailable (dev boot), we log via pino so nothing is lost silently.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Optional()
    @InjectQueue(AUDIT_QUEUE)
    private readonly queue: Queue | undefined,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    if (!this.queue) {
      this.logger.warn({ event }, 'audit queue unavailable — writing to logs only');
      return;
    }
    try {
      await this.queue.add('record', event, {
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      });
    } catch (err) {
      this.logger.error({ err, event }, 'failed to enqueue audit event');
    }
  }
}
