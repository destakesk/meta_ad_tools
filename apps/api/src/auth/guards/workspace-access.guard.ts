import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole } from '@metaflow/database';
import type { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service.js';

import type { RequestUser } from '../decorators/current-user.decorator.js';

/**
 * Resolves `:workspaceSlug` (URL param) → Workspace + membership for the
 * current user. ORG_OWNER gets access without an explicit WorkspaceMembership.
 * Populates `request.workspace` + `request.workspaceMembership` for decorators.
 */
@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: RequestUser;
        workspace?: unknown;
        workspaceMembership?: unknown;
      }
    >();

    if (!req.user) throw new ForbiddenException('auth_required');

    const slug =
      (req.params as Record<string, string | undefined>)['workspaceSlug'] ??
      (req.params as Record<string, string | undefined>)['slug'];
    if (!slug) throw new NotFoundException('workspace_slug_missing');

    const workspace = await this.prisma.workspace.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!workspace) throw new NotFoundException('workspace_not_found');

    const wsMembership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.user.userId } },
    });

    if (!wsMembership) {
      // Org owner fallback
      const orgMembership = await this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: workspace.organizationId,
            userId: req.user.userId,
          },
        },
      });
      if (!orgMembership || orgMembership.role !== OrgRole.OWNER) {
        throw new ForbiddenException('workspace_access_denied');
      }
    }

    req.workspace = workspace;
    req.workspaceMembership = wsMembership ?? null;
    return true;
  }
}
