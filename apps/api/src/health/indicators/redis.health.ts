import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';

import { RedisService } from '../../redis/redis.service.js';

import type { HealthIndicatorResult } from '@nestjs/terminus';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async pingCheck(key: string, timeoutMs = 2000): Promise<HealthIndicatorResult> {
    const ok = await this.redis.ping(timeoutMs);
    if (ok) {
      return this.getStatus(key, true, { state: 'connected' });
    }
    throw new HealthCheckError(
      'Redis check failed',
      this.getStatus(key, false, { state: 'disconnected' }),
    );
  }
}
