import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Executes `SELECT 1` with a hard timeout. Returns `connected`/`disconnected`
 * on the supplied key so the Terminus aggregator can roll services up into
 * one `{ status, info, error, details }` response.
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async pingCheck(key: string, timeoutMs = 2000): Promise<HealthIndicatorResult> {
    try {
      await Promise.race([
        this.prisma.$queryRawUnsafe<[{ ok: number }]>('SELECT 1 as ok'),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`postgres ping timed out after ${timeoutMs.toString()}ms`));
          }, timeoutMs);
        }),
      ]);
      return this.getStatus(key, true, { state: 'connected' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new HealthCheckError(
        'Postgres check failed',
        this.getStatus(key, false, { state: 'disconnected', error: message }),
      );
    }
  }
}
