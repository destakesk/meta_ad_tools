import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { WorkspaceAccessGuard } from '../auth/guards/workspace-access.guard.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrgRole } from '@metaflow/database';

@Controller('workspaces')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  CustomHeaderGuard,
  WorkspaceAccessGuard,
  PermissionGuard,
)
export class WorkspacesController {
  constructor(private readonly prisma: PrismaService) {}

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
}
