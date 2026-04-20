import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuditService } from '../auth/services/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';
import { MetaConnectionsService } from './meta-connections.service.js';

import type { MetaApiClient } from './meta-api-client.interface.js';
import type { AppConfig } from '../config/configuration.js';

class OAuthCallbackDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) state!: string;
}

interface StatePayload {
  workspaceId: string;
  userId: string;
}

/**
 * Workspace-less OAuth callback. Meta's `redirect_uri` is registered as a
 * single, fixed URL on the Meta app side — it cannot carry the workspace
 * slug. We use Redis-backed `state` to remember which workspace the user
 * was connecting for and resolve it here.
 *
 * Returns the workspace slug so the frontend can navigate the user back
 * to /w/<slug>/settings/meta after the connect succeeds.
 */
@Controller('meta')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, CustomHeaderGuard)
export class MetaCallbackController {
  constructor(
    private readonly connections: MetaConnectionsService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  @Post('connect/callback')
  @HttpCode(HttpStatus.OK)
  async callback(@CurrentUser() user: RequestUser, @Body() dto: OAuthCallbackDto) {
    const stateRaw = await this.redis.client.get(this.stateKey(dto.state));
    if (stateRaw === null) {
      await this.audit.record({
        action: 'meta.oauth.callback.failed',
        userId: user.userId,
        metadata: { reason: 'state_invalid_or_expired' },
      });
      throw new BadRequestException('oauth_state_invalid_or_expired');
    }
    await this.redis.client.del(this.stateKey(dto.state));

    const payload = JSON.parse(stateRaw) as StatePayload;
    if (payload.userId !== user.userId) {
      // Different user finished the flow than the one who initiated it —
      // possible CSRF, definitely abuse.
      await this.audit.record({
        action: 'meta.oauth.callback.failed',
        userId: user.userId,
        metadata: { reason: 'state_user_mismatch' },
      });
      throw new BadRequestException('oauth_state_user_mismatch');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: payload.workspaceId },
    });
    if (!workspace) throw new NotFoundException('workspace_not_found');

    const cfg = this.config.get('meta', { infer: true });
    const tokens = await this.meta.exchangeCode({
      code: dto.code,
      redirectUri: cfg.redirectUri,
    });
    const profile = await this.meta.fetchProfile(tokens.accessToken);

    const connection = await this.connections.connect({
      workspaceId: workspace.id,
      userId: user.userId,
      tokens,
      profile,
    });

    await this.audit.record({
      action: 'meta.oauth.callback.success',
      userId: user.userId,
      targetType: 'meta_connection',
      targetId: connection.id,
    });

    return { connection, workspaceSlug: workspace.slug };
  }

  private stateKey(state: string): string {
    return `meta_oauth_state:${state}`;
  }
}
