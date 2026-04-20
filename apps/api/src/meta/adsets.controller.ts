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
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { WorkspaceAccessGuard } from '../auth/guards/workspace-access.guard.js';

import { AdSetsService } from './adsets.service.js';
import { InsightsService } from './insights.service.js';

class CreateAdSetDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(['ACTIVE', 'PAUSED']) status!: 'ACTIVE' | 'PAUSED';
  @IsString() @MinLength(1) @MaxLength(100) optimizationGoal!: string;
  @IsString() @MinLength(1) @MaxLength(100) billingEvent!: string;

  @IsOptional() @IsInt() @Min(0) dailyBudgetCents?: number;
  @IsOptional() @IsInt() @Min(0) lifetimeBudgetCents?: number;

  @IsOptional() @IsISO8601() startTime?: string;
  @IsOptional() @IsISO8601() endTime?: string;

  @IsOptional() @IsObject() targeting?: Record<string, unknown>;
}

class InsightQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
}

class InsightSyncDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

class UpdateAdSetDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED']) status?: 'ACTIVE' | 'PAUSED';

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  dailyBudgetCents?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  lifetimeBudgetCents?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  endTime?: string | null;

  @IsOptional() @IsObject() targeting?: Record<string, unknown>;
}

/**
 * Campaign-scoped routes — list, sync, and create live under the parent
 * campaign id. Detail / update / delete use a workspace-scoped /adsets/:id
 * path so the caller doesn't have to thread the campaign id through.
 */
@Controller('workspaces/:slug/campaigns/:campaignId/adsets')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class CampaignAdSetsController {
  constructor(private readonly adsets: AdSetsService) {}

  @Get()
  @RequirePermission('campaign:read')
  async list(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
  ) {
    const adSets = await this.adsets.listForCampaign(ws.workspace.id, campaignId);
    return { adSets };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('campaign:read')
  async sync(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
  ) {
    return this.adsets.syncForCampaign(ws.workspace.id, user.userId, campaignId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('adset:write')
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAdSetDto,
  ) {
    const adSet = await this.adsets.create(ws.workspace.id, user.userId, {
      campaignId,
      name: dto.name,
      status: dto.status,
      optimizationGoal: dto.optimizationGoal,
      billingEvent: dto.billingEvent,
      ...(dto.dailyBudgetCents !== undefined
        ? { dailyBudgetCents: dto.dailyBudgetCents.toString() }
        : {}),
      ...(dto.lifetimeBudgetCents !== undefined
        ? { lifetimeBudgetCents: dto.lifetimeBudgetCents.toString() }
        : {}),
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.targeting !== undefined ? { targeting: dto.targeting } : {}),
    });
    return { adSet };
  }
}

@Controller('workspaces/:slug/adsets')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class AdSetsController {
  constructor(
    private readonly adsets: AdSetsService,
    private readonly insights: InsightsService,
  ) {}

  @Get(':id')
  @RequirePermission('campaign:read')
  async detail(@CurrentWorkspace() ws: { workspace: { id: string } }, @Param('id') id: string) {
    const adSet = await this.adsets.getById(ws.workspace.id, id);
    return { adSet };
  }

  @Get(':id/insights')
  @RequirePermission('insights:read')
  async insightsList(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
    @Query() query: InsightQueryDto,
  ) {
    return this.insights.listForAdSet(ws.workspace.id, id, query.from, query.to);
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
    return this.insights.syncForAdSet(ws.workspace.id, user.userId, id, dto.from, dto.to);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('adset:write')
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAdSetDto,
  ) {
    const adSet = await this.adsets.update(ws.workspace.id, user.userId, id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.dailyBudgetCents !== undefined
        ? {
            dailyBudgetCents:
              dto.dailyBudgetCents === null ? null : dto.dailyBudgetCents.toString(),
          }
        : {}),
      ...(dto.lifetimeBudgetCents !== undefined
        ? {
            lifetimeBudgetCents:
              dto.lifetimeBudgetCents === null ? null : dto.lifetimeBudgetCents.toString(),
          }
        : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.targeting !== undefined ? { targeting: dto.targeting } : {}),
    });
    return { adSet };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('adset:delete')
  async delete(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
  ) {
    await this.adsets.delete(ws.workspace.id, user.userId, id);
    return { ok: true };
  }
}
