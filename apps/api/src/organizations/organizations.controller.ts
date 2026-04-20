import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';

import { OrganizationsService } from './organizations.service.js';

class InviteMemberDto {
  @IsEmail() email!: string;
  @IsIn(['ORG_ADMIN', 'ORG_MEMBER', 'WS_ADMIN', 'WS_MANAGER', 'WS_VIEWER']) role!: string;
  @IsOptional() @IsString() workspaceId?: string;
}

class CreateWorkspaceDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsString() @MinLength(2) @MaxLength(50) @Matches(/^[a-z0-9-]+$/) slug!: string;
}

class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, CustomHeaderGuard, PermissionGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get('current')
  async current(@CurrentUser() user: RequestUser) {
    return this.orgs.currentForUser(user.userId);
  }

  @Get(':orgId/members')
  @RequirePermission('org:read')
  async listMembers(@Param('orgId') orgId: string) {
    return this.orgs.listMembers(orgId);
  }

  @Patch(':orgId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('org:update')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    if (dto.name === undefined) return { ok: true, noop: true };
    return this.orgs.rename(user.userId, orgId, dto.name);
  }

  @Post(':orgId/members/invite')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('member:invite')
  async invite(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgs.invite(user.userId, orgId, dto);
  }

  @Post(':orgId/workspaces')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('workspace:create')
  async createWorkspace(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.orgs.createWorkspace(user.userId, orgId, dto);
  }
}
