import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AuditService, AUDIT_QUEUE } from '../auth/services/audit.service.js';
import { AuditProcessor } from './audit.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: AUDIT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    }),
  ],
  providers: [AuditProcessor, AuditService],
  exports: [AuditService, BullModule],
})
export class AuditModule {}
