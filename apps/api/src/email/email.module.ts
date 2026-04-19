import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { EmailProcessor } from './email.processor.js';
import { EmailService, EMAIL_QUEUE } from './email.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
