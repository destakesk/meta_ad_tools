import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { WorkspaceAccessGuard } from '../auth/guards/workspace-access.guard.js';

import { CreativesService } from './creatives.service.js';

class CreateCreativeDto {
  @IsString() @MinLength(1) adAccountId!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(['IMAGE', 'VIDEO', 'CAROUSEL', 'LINK', 'POST']) kind!:
    | 'IMAGE'
    | 'VIDEO'
    | 'CAROUSEL'
    | 'LINK'
    | 'POST';

  @IsOptional() @IsUrl() thumbUrl?: string;
  @IsOptional() @IsObject() objectStorySpec?: Record<string, unknown>;
}

/**
 * AdAccount-scoped routes — list + sync for a specific ad account.
 */
@Controller('workspaces/:slug/adaccounts/:adAccountId/creatives')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class AdAccountCreativesController {
  constructor(private readonly creatives: CreativesService) {}

  @Get()
  @RequirePermission('creative:read')
  async list(
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('adAccountId') adAccountId: string,
  ) {
    const creatives = await this.creatives.listForAdAccount(ws.workspace.id, adAccountId);
    return { creatives };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('creative:read')
  async sync(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('adAccountId') adAccountId: string,
  ) {
    return this.creatives.syncForAdAccount(ws.workspace.id, user.userId, adAccountId);
  }
}

/**
 * Workspace-level creative library. Lists all creatives across every ad
 * account in the workspace; create / delete route through here because
 * we don't require the caller to know the ad account id on detail paths.
 */
@Controller('workspaces/:slug/creatives')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class CreativesController {
  constructor(private readonly creatives: CreativesService) {}

  @Get()
  @RequirePermission('creative:read')
  async list(@CurrentWorkspace() ws: { workspace: { id: string } }) {
    const creatives = await this.creatives.listForWorkspace(ws.workspace.id);
    return { creatives };
  }

  @Get(':id')
  @RequirePermission('creative:read')
  async detail(@CurrentWorkspace() ws: { workspace: { id: string } }, @Param('id') id: string) {
    const creative = await this.creatives.getById(ws.workspace.id, id);
    return { creative };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('creative:write')
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Body() dto: CreateCreativeDto,
  ) {
    const creative = await this.creatives.create(ws.workspace.id, user.userId, {
      adAccountId: dto.adAccountId,
      name: dto.name,
      kind: dto.kind,
      ...(dto.thumbUrl !== undefined ? { thumbUrl: dto.thumbUrl } : {}),
      ...(dto.objectStorySpec !== undefined ? { objectStorySpec: dto.objectStorySpec } : {}),
    });
    return { creative };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('creative:delete')
  async delete(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: { workspace: { id: string } },
    @Param('id') id: string,
  ) {
    await this.creatives.delete(ws.workspace.id, user.userId, id);
    return { ok: true };
  }
}
