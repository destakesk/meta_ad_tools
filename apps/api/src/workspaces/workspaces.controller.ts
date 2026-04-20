import { OrgRole } from '@metaflow/database';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { WorkspaceAccessGuard } from '../auth/guards/workspace-access.guard.js';
import { AuditService } from '../auth/services/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

class UpdateWorkspaceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) name?: string;
}

@Controller('workspaces')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class WorkspacesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get(':slug')
  @RequirePermission('workspace:read')
  async get(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace()
    wsCtx: ReturnType<typeof CurrentWorkspace> extends never
      ? never
      : {
          workspace: {
            id: string;
            organizationId: string;
            name: string;
            slug: string;
            archivedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
          };
          membership: { role: string } | null;
        },
    @Param('slug') _slug: string,
  ) {
    const { workspace, membership } = wsCtx;
    let userRole = membership?.role ?? null;
    if (!userRole) {
      const org = await this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: workspace.organizationId, userId: user.userId },
        },
      });
      if (org?.role === OrgRole.OWNER) userRole = 'ADMIN';
    }
    return {
      workspace: {
        id: workspace.id,
        organizationId: workspace.organizationId,
        name: workspace.name,
        slug: workspace.slug,
        archivedAt: workspace.archivedAt?.toISOString() ?? null,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
      userRole,
    };
  }

  @Patch(':slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('workspace:update')
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace()
    wsCtx: { workspace: { id: string; slug: string }; membership: { role: string } | null },
    @Param('slug') _slug: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    if (dto.name === undefined) return { ok: true, noop: true };
    const updated = await this.prisma.workspace.update({
      where: { id: wsCtx.workspace.id },
      data: { name: dto.name },
    });
    await this.audit.record({
      action: 'workspace.renamed',
      userId: user.userId,
      targetType: 'workspace',
      targetId: updated.id,
      metadata: { meta: { name: dto.name } },
    });
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      name: updated.name,
      slug: updated.slug,
      archivedAt: updated.archivedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
