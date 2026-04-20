import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { WorkspaceAccessGuard } from '../auth/guards/workspace-access.guard.js';

import { AdsService } from './ads.service.js';
import { InsightsService } from './insights.service.js';

class CreateAdDto {
  @IsString() @MinLength(1) creativeId!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(['ACTIVE', 'PAUSED']) status!: 'ACTIVE' | 'PAUSED';
}

class InsightQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
}

class InsightSyncDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

class UpdateAdDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED']) status?: 'ACTIVE' | 'PAUSED';
  @IsOptional() @IsString() @MinLength(1) creativeId?: string;
}

/**
 * AdSet-scoped routes — list, sync, and create live under the parent
 * ad set id. Detail / update / delete use workspace-scoped /ads/:id so the
 * caller doesn't have to thread the ad set id through.
 */
@Controller('workspaces/:slug/adsets/:adsetId/ads')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class AdSetAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  @RequirePermission('campaign:read')
  async list(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('adsetId') adsetId: string,
  ) {
    const ads = await this.ads.listForAdSet(ws.workspace.id, adsetId);
    return { ads };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('campaign:read')
  async sync(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('adsetId') adsetId: string,
  ) {
    return this.ads.syncForAdSet(ws.workspace.id, user.userId, adsetId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ad:write')
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('adsetId') adsetId: string,
    @Body() dto: CreateAdDto,
  ) {
    const ad = await this.ads.create(ws.workspace.id, user.userId, {
      adsetId,
      creativeId: dto.creativeId,
      name: dto.name,
      status: dto.status,
    });
    return { ad };
  }
}

@Controller('workspaces/:slug/ads')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly insights: InsightsService,
  ) {}

  @Get(':id')
  @RequirePermission('campaign:read')
  async detail(@CurrentWorkspace() ws: { workspace: { id: string } }, @Param('id') id: string) {
    const ad = await this.ads.getById(ws.workspace.id, id);
    return { ad };
  }

  @Get(':id/insights')
  @RequirePermission('insights:read')
  async insightsList(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
    @Query() query: InsightQueryDto,
  ) {
    return this.insights.listForAd(ws.workspace.id, id, query.from, query.to);
  }

  @Post(':id/insights/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insights:read')
  async insightsSync(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
    @Body() dto: InsightSyncDto,
  ) {
    return this.insights.syncForAd(ws.workspace.id, user.userId, id, dto.from, dto.to);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ad:write')
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAdDto,
  ) {
    const ad = await this.ads.update(ws.workspace.id, user.userId, id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.creativeId !== undefined ? { creativeId: dto.creativeId } : {}),
    });
    return { ad };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ad:delete')
  async delete(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
  ) {
    await this.ads.delete(ws.workspace.id, user.userId, id);
    return { ok: true };
  }
}
