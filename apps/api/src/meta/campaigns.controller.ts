import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

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
