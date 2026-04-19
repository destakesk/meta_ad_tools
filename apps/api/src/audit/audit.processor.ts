import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service.js';
import { AUDIT_QUEUE } from '../auth/services/audit.service.js';

import type { AuditEvent } from '../auth/services/audit.service.js';

@Processor(AUDIT_QUEUE)
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AuditEvent>): Promise<void> {
    const { action, userId, targetType, targetId, metadata, ipAddress, userAgent } = job.data;
    await this.prisma.auditLog.create({
      data: {
        action,
        userId: userId ?? null,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        metadata: (metadata ?? {}) as object,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
    this.logger.debug({ action, userId }, 'audit log written');
  }
}
