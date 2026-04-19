import { Module } from '@nestjs/common';

import { SessionCleanupService } from './session-cleanup.service.js';

@Module({
  providers: [SessionCleanupService],
})
export class SessionModule {}
