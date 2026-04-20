import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { WorkspaceAccessGuard } from '../auth/guards/workspace-access.guard.js';
import { AuditService } from '../auth/services/audit.service.js';
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
 * Module 03 — Meta Ads connection endpoints.
 *
 * Routes are workspace-scoped; access goes through WorkspaceAccessGuard so
 * the current user must already be a member (or ORG_OWNER inheriting). The
 * BISU permission keys (already seeded in Module 02) gate connect / rotate
 * / disconnect.
 *
 * OAuth `state` is a 32-byte random string stored in Redis with a short TTL
 * (default 10 min). Callback verifies state → workspace mapping before the
 * code is ever exchanged, blocking CSRF-style attacks where someone tricks
 * a logged-in user into completing a Meta consent for the attacker's app.
 */
@Controller('workspaces/:slug/meta')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class MetaController {
  constructor(
    private readonly connections: MetaConnectionsService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  @Get()
  @RequirePermission('workspace:read')
  async current(@CurrentWorkspace() ws: { workspace: { id: string } }) {
    const connection = await this.connections.getByWorkspace(ws.workspace.id);
    return { connection };
  }

  @Post('connect/init')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bisu:connect')
  async initConnect(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
  ) {
    const cfg = this.config.get('meta', { infer: true });
    const state = randomBytes(32).toString('hex');
    const payload: StatePayload = { workspaceId: ws.workspace.id, userId: user.userId };

    await this.redis.client.set(
      this.stateKey(state),
      JSON.stringify(payload),
      'EX',
      cfg.stateTtlSeconds,
    );

    const authorizeUrl = this.meta.buildAuthorizeUrl({
      state,
      redirectUri: cfg.redirectUri,
      scopes: cfg.scopes,
    });

    await this.audit.record({
      action: 'meta.oauth.initiated',
      userId: user.userId,
      targetType: 'workspace',
      targetId: ws.workspace.id,
    });

    return { authorizeUrl, state, expiresInSeconds: cfg.stateTtlSeconds };
  }

  @Post('connect/callback')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bisu:connect')
  async callback(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Body() dto: OAuthCallbackDto,
  ) {
    const stateRaw = await this.redis.client.get(this.stateKey(dto.state));
    if (stateRaw === null) {
      await this.audit.record({
        action: 'meta.oauth.callback.failed',
        userId: user.userId,
        targetType: 'workspace',
        targetId: ws.workspace.id,
        metadata: { reason: 'state_invalid_or_expired' },
      });
      throw new BadRequestException('oauth_state_invalid_or_expired');
    }
    await this.redis.client.del(this.stateKey(dto.state));

    const payload = JSON.parse(stateRaw) as StatePayload;
    if (payload.workspaceId !== ws.workspace.id || payload.userId !== user.userId) {
      throw new BadRequestException('oauth_state_workspace_mismatch');
    }

    const cfg = this.config.get('meta', { infer: true });
    const tokens = await this.meta.exchangeCode({
      code: dto.code,
      redirectUri: cfg.redirectUri,
    });
    const profile = await this.meta.fetchProfile(tokens.accessToken);

    const connection = await this.connections.connect({
      workspaceId: ws.workspace.id,
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

    return { connection };
  }

  @Post(':connectionId/rotate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bisu:rotate')
  async rotate(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('connectionId') connectionId: string,
  ) {
    await this.assertConnectionInWorkspace(connectionId, ws.workspace.id);
    const connection = await this.connections.rotate(connectionId, user.userId);
    return { connection };
  }

  @Delete(':connectionId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bisu:disconnect')
  async disconnect(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('connectionId') connectionId: string,
  ) {
    await this.assertConnectionInWorkspace(connectionId, ws.workspace.id);
    await this.connections.disconnect(connectionId, user.userId);
    return { ok: true };
  }

  @Post(':connectionId/ad-accounts/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('adaccount:read')
  async syncAdAccounts(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('connectionId') connectionId: string,
  ) {
    await this.assertConnectionInWorkspace(connectionId, ws.workspace.id);
    const adAccounts = await this.connections.syncAdAccounts(connectionId, user.userId);
    return { adAccounts };
  }

  @Get(':connectionId/ad-accounts')
  @RequirePermission('adaccount:read')
  async listAdAccounts(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('connectionId') connectionId: string,
  ) {
    await this.assertConnectionInWorkspace(connectionId, ws.workspace.id);
    const adAccounts = await this.connections.listAdAccounts(connectionId);
    return { adAccounts };
  }

  private async assertConnectionInWorkspace(
    connectionId: string,
    workspaceId: string,
  ): Promise<void> {
    const owned = await this.connections.getByWorkspace(workspaceId);
    if (owned?.id !== connectionId) {
      throw new NotFoundException('meta_connection_not_found_in_workspace');
    }
  }

  private stateKey(state: string): string {
    return `meta_oauth_state:${state}`;
  }
}
