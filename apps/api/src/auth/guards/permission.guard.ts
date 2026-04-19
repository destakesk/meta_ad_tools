import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { permissionScope } from '@metaflow/shared-types';
import type { PermissionKey } from '@metaflow/shared-types';
import type { Workspace } from '@metaflow/database';
import type { Request } from 'express';

import { PermissionResolver } from '../../permissions/permission-resolver.service.js';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator.js';

import type { RequestUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<PermissionKey>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true; // no permission required

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser; workspace?: Workspace }>();
    if (!req.user) throw new ForbiddenException('auth_required');

    const scope = permissionScope(permission);
    const ctx: { organizationId?: string; workspaceId?: string } = {};
    if (scope === 'workspace') {
      if (!req.workspace) throw new ForbiddenException('workspace_required');
      ctx.workspaceId = req.workspace.id;
      ctx.organizationId = req.workspace.organizationId;
    } else {
      const orgId = (req.params as Record<string, string | undefined>)['orgId'];
      if (orgId) ctx.organizationId = orgId;
    }

    const allowed = await this.resolver.can(req.user.userId, permission, ctx);
    if (!allowed) throw new ForbiddenException('insufficient_permission');
    return true;
  }
}
