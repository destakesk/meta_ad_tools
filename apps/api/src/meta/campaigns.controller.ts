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
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
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

import { CampaignsService } from './campaigns.service.js';
import { InsightsService } from './insights.service.js';

class InsightSyncDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

class InsightQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
}

class CreateCampaignDto {
  @IsString() @MinLength(1) adAccountId!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @MinLength(1) @MaxLength(100) objective!: string;
  @IsIn(['ACTIVE', 'PAUSED']) status!: 'ACTIVE' | 'PAUSED';

  @IsOptional() @IsInt() @Min(0) dailyBudgetCents?: number;
  @IsOptional() @IsInt() @Min(0) lifetimeBudgetCents?: number;

  @IsOptional() @IsISO8601() startTime?: string;
  @IsOptional() @IsISO8601() endTime?: string;
}

class UpdateCampaignDto {
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
}

@Controller('workspaces/:slug/campaigns')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly insights: InsightsService,
  ) {}

  @Get()
  @RequirePermission('campaign:read')
  async list(@CurrentWorkspace() ws: { workspace: { id: string } }) {
    const campaigns = await this.campaigns.listForWorkspace(ws.workspace.id);
    return { campaigns };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('campaign:write')
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Body() dto: CreateCampaignDto,
  ) {
    const campaign = await this.campaigns.create(ws.workspace.id, user.userId, {
      adAccountId: dto.adAccountId,
      name: dto.name,
      objective: dto.objective,
      status: dto.status,
      ...(dto.dailyBudgetCents !== undefined
        ? { dailyBudgetCents: dto.dailyBudgetCents.toString() }
        : {}),
      ...(dto.lifetimeBudgetCents !== undefined
        ? { lifetimeBudgetCents: dto.lifetimeBudgetCents.toString() }
        : {}),
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
    });
    return { campaign };
  }

  @Patch(':campaignId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('campaign:write')
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const campaign = await this.campaigns.update(ws.workspace.id, user.userId, campaignId, {
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
    });
    return { campaign };
  }

  @Delete(':campaignId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('campaign:delete')
  async delete(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
  ) {
    await this.campaigns.delete(ws.workspace.id, user.userId, campaignId);
    return { ok: true };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('campaign:read')
  async sync(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
  ) {
    return this.campaigns.syncFromMeta(ws.workspace.id, user.userId);
  }

  @Get(':campaignId')
  @RequirePermission('campaign:read')
  async detail(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
  ) {
    const campaign = await this.campaigns.getById(ws.workspace.id, campaignId);
    return { campaign };
  }

  @Get(':campaignId/insights')
  @RequirePermission('insights:read')
  async campaignInsights(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('campaignId') campaignId: string,
    @Query() query: InsightQueryDto,
  ) {
    // Re-use the workspace-wide pull but filter to this campaign's rows.
    const all = await this.insights.listForWorkspace(ws.workspace.id, query.from, query.to);
    const rows = all.rows.filter((r) => r.campaignId === campaignId);
    const totals = rows.reduce(
      (acc, r) => ({
        impressions: (BigInt(acc.impressions) + BigInt(r.impressions)).toString(),
        clicks: (BigInt(acc.clicks) + BigInt(r.clicks)).toString(),
        spendCents: (BigInt(acc.spendCents) + BigInt(r.spendCents)).toString(),
        conversions: (BigInt(acc.conversions) + BigInt(r.conversions)).toString(),
      }),
      { impressions: '0', clicks: '0', spendCents: '0', conversions: '0' },
    );
    return { rows, totals, from: all.from, to: all.to };
  }
}

@Controller('workspaces/:slug/insights')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  @RequirePermission('insights:read')
  async list(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Query() query: InsightQueryDto,
  ) {
    return this.insights.listForWorkspace(ws.workspace.id, query.from, query.to);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insights:read')
  async sync(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Body() dto: InsightSyncDto,
  ) {
    return this.insights.syncForWorkspace(ws.workspace.id, user.userId, dto.from, dto.to);
  }
}
