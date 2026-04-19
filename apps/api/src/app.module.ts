import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { LoggerModule } from './common/logging/logger.module.js';
import { configuration } from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SessionModule } from './session/session.module.js';

import type { AppConfig } from './config/configuration.js';

/**
 * Module 02 Phase 7: swapped the default in-memory ThrottlerStorage for a
 * Redis-backed one (via @nest-lab/throttler-storage-redis) so rate-limit state
 * survives restarts and works across horizontally-scaled API replicas.
 *
 * Per-route custom trackers (ip+email, user, session) are deferred to Phase 9
 * where auth endpoints use explicit @Throttle() overrides with different
 * limits per route.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { url, prefix } = config.get('redis', { infer: true });
        const parsed = new URL(url);
        return {
          connection: {
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port, 10) : 6379,
            password: parsed.password || undefined,
            username: parsed.username || undefined,
          },
          prefix: `${prefix}bull`,
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttl, limit } = config.get('throttle', { infer: true });
        const { url } = config.get('redis', { infer: true });
        return {
          throttlers: [{ name: 'default', ttl: ttl * 1000, limit }],
          // Pass the URL so the storage manages its own Redis connection
          // (independent of RedisService lifecycle).
          storage: new ThrottlerStorageRedisService(url),
        };
      },
    }),
    PrismaModule,
    RedisModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    AuditModule,
    EmailModule,
    SessionModule,
    PermissionsModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    InvitationsModule,
    QueueModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
