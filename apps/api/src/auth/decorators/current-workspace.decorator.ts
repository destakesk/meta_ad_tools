import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Workspace, WorkspaceMembership } from '@metaflow/database';

export interface WorkspaceContext {
  workspace: Workspace;
  membership: WorkspaceMembership | null; // null if ORG_OWNER inherited
}

export const CurrentWorkspace = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): WorkspaceContext => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ workspace?: Workspace; workspaceMembership?: WorkspaceMembership | null }>();
    if (!req.workspace) throw new Error('CurrentWorkspace requires WorkspaceAccessGuard');
    return { workspace: req.workspace, membership: req.workspaceMembership ?? null };
  },
);
