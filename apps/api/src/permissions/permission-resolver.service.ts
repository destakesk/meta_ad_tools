import { OrgRole, ROLE_PERMISSIONS, WorkspaceRole } from '@metaflow/database';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import type { PermissionKey } from '@metaflow/shared-types';

/**
 * Resolves whether a given user has a given permission, with two inheritance
 * rules:
 *   1. ORG_OWNER is a superuser in their org (implicit WS_ADMIN everywhere).
 *   2. ORG_ADMIN / ORG_MEMBER fall back to whatever the org role permits.
 *
 * Resolution is cached in Redis for 60s per (userId, orgId, workspaceId?).
 * Role/membership writes MUST call `invalidate(userId)` — done by the
 * controllers that mutate memberships.
 */
@Injectable()
export class PermissionResolver {
  private static readonly CACHE_TTL = 60; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async can(
    userId: string,
    permission: PermissionKey,
    ctx: { organizationId?: string; workspaceId?: string },
  ): Promise<boolean> {
    const perms = await this.effectivePermissions(userId, ctx);
    return perms.has(permission);
  }

  async effectivePermissions(
    userId: string,
    ctx: { organizationId?: string; workspaceId?: string },
  ): Promise<Set<string>> {
    const cacheKey = `perm:${userId}:${ctx.organizationId ?? '-'}:${ctx.workspaceId ?? '-'}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      return new Set<string>(JSON.parse(cached) as string[]);
    }

    const perms = new Set<string>();

    const orgId =
      ctx.organizationId ??
      (ctx.workspaceId
        ? (
            await this.prisma.workspace.findUnique({
              where: { id: ctx.workspaceId },
              select: { organizationId: true },
            })
          )?.organizationId
        : undefined);

    if (orgId) {
      const orgMembership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } },
      });
      if (orgMembership) {
        if (orgMembership.role === OrgRole.OWNER) {
          for (const p of ROLE_PERMISSIONS.ORG_OWNER) perms.add(p);
          // ORG_OWNER inherits WS_ADMIN in every workspace of the org.
          for (const p of ROLE_PERMISSIONS.WS_ADMIN) perms.add(p);
        } else if (orgMembership.role === OrgRole.ADMIN) {
          for (const p of ROLE_PERMISSIONS.ORG_ADMIN) perms.add(p);
        } else {
          for (const p of ROLE_PERMISSIONS.ORG_MEMBER) perms.add(p);
        }
      }
    }

    if (ctx.workspaceId) {
      const wsMembership = await this.prisma.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId } },
      });
      if (wsMembership) {
        const role = wsMembership.role;
        if (role === WorkspaceRole.ADMIN) {
          for (const p of ROLE_PERMISSIONS.WS_ADMIN) perms.add(p);
        } else if (role === WorkspaceRole.MANAGER) {
          for (const p of ROLE_PERMISSIONS.WS_MANAGER) perms.add(p);
        } else {
          for (const p of ROLE_PERMISSIONS.WS_VIEWER) perms.add(p);
        }
      }
    }

    await this.redis.client.setex(
      cacheKey,
      PermissionResolver.CACHE_TTL,
      JSON.stringify([...perms]),
    );
    return perms;
  }

  async invalidate(userId: string): Promise<void> {
    // Redis KEYS in production is scary at scale — for Module 02 the cardinality
    // of `perm:<uid>:*` is bounded by the org/workspace count per user. Acceptable.
    const pattern = `perm:${userId}:*`;
    const keys = await this.redis.client.keys(pattern);
    if (keys.length > 0) await this.redis.client.del(...keys);
  }
}
