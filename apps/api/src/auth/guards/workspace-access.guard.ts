import { OrgRole } from '@metaflow/database';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

import type { RequestUser } from '../decorators/current-user.decorator.js';
import type { Request } from 'express';

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

    // Slug is unique per-organization, not globally. Without scoping the
    // lookup to organizations the caller belongs to, `findFirst` would
    // happily return some other tenant's workspace and the membership check
    // would then deny access — the user gets a confusing 403 for a
    // workspace they should never have seen.
    const orgIds = (
      await this.prisma.organizationMembership.findMany({
        where: { userId: req.user.userId },
        select: { organizationId: true },
      })
    ).map((m) => m.organizationId);

    const workspace = await this.prisma.workspace.findFirst({
      where: { slug, deletedAt: null, organizationId: { in: orgIds } },
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
      if (orgMembership?.role !== OrgRole.OWNER) {
        throw new ForbiddenException('workspace_access_denied');
      }
    }

    req.workspace = workspace;
    req.workspaceMembership = wsMembership ?? null;
    return true;
  }
}
