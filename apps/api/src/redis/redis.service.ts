import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import type { Redis } from 'ioredis';

import type { AppConfig } from '../config/configuration.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private clientInstance: Redis | undefined;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const { url, prefix } = this.config.get('redis', { infer: true });
    this.clientInstance = new IORedis(url, {
      keyPrefix: prefix,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    this.clientInstance.on('connect', () => {
      this.logger.log('redis connected');
    });
    this.clientInstance.on('error', (err: Error) => {
      this.logger.error(`redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.clientInstance) {
      await this.clientInstance.quit();
      this.logger.log('redis disconnected');
    }
  }

  get client(): Redis {
    if (!this.clientInstance) {
      throw new Error('Redis client not initialised');
    }
    return this.clientInstance;
  }

  async ping(timeoutMs = 2000): Promise<boolean> {
    const pingPromise = this.client.ping();
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`redis ping timed out after ${timeoutMs.toString()}ms`));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([pingPromise, timeout]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
