import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaHealthIndicator } from './indicators/prisma.health.js';
import { RedisHealthIndicator } from './indicators/redis.health.js';

import type { HealthCheckResult } from '@nestjs/terminus';

/**
 * Three probes:
 *   /health        — full readiness: postgres + redis. Drives the frontend
 *                    status page. 503 if any required service is down.
 *   /health/live   — liveness: process is responsive. No downstream checks.
 *   /health/ready  — kubernetes-style readiness (alias for /health).
 *
 * All are excluded from the global throttler — health endpoints should never
 * be rate-limited.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.pingCheck('database', 2000),
      () => this.redis.pingCheck('redis', 2000),
    ]);
  }

  @Get('live')
  live(): { status: 'ok'; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.pingCheck('database', 2000),
      () => this.redis.pingCheck('redis', 2000),
    ]);
  }
}
