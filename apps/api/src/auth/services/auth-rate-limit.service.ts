import { Injectable } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service.js';

/**
 * Ad-hoc Redis counter for auth flows that need finer-grained control than
 * `@nestjs/throttler` offers — e.g., count only FAILED login attempts, or
 * tie the window to a userId not an IP.
 *
 * Semantics:
 *   register(key, windowSec, limit) → { count, limited, retryAfterSec }
 *     - INCR the key, set TTL on first increment
 *     - `limited` is true when count > limit
 *   reset(key) → DEL
 *   isLimited(key, limit) → read-only check
 */
@Injectable()
export class AuthRateLimitService {
  constructor(private readonly redis: RedisService) {}

  async register(
    key: string,
    windowSec: number,
    limit: number,
  ): Promise<{ count: number; limited: boolean; retryAfterSec: number }> {
    const client = this.redis.client;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSec);
    }
    const ttl = await client.ttl(key);
    return {
      count,
      limited: count > limit,
      retryAfterSec: ttl > 0 ? ttl : windowSec,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.client.del(key);
  }

  async isLimited(key: string, limit: number): Promise<boolean> {
    const raw = await this.redis.client.get(key);
    if (!raw) return false;
    return parseInt(raw, 10) > limit;
  }
}
