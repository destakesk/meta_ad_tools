import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration.js';

/**
 * BullMQ skeleton.
 *
 * Module 01 intentionally does not create any queues — the connection config
 * is derived on demand via `bullConnectionFactory` so Module 02 can import
 * it when registering the first concrete queue.
 */
export const bullConnectionFactory = {
  provide: 'BULL_CONNECTION_OPTIONS',
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>) => {
    const { url, prefix } = config.get('redis', { infer: true });
    return {
      connection: { url },
      prefix: `${prefix}bull:`,
    };
  },
};

@Module({
  providers: [bullConnectionFactory],
  exports: [bullConnectionFactory],
})
export class QueueModule {}
