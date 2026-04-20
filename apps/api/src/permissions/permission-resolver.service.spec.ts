import { OrgRole, WorkspaceRole } from '@metaflow/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionResolver } from './permission-resolver.service.js';

type Resolver = PermissionResolver;

function makeResolver(state: {
  orgMembership?: { role: OrgRole } | null;
  wsMembership?: { role: WorkspaceRole } | null;
}): Resolver {
  const prisma = {
    workspace: {
      findUnique: vi.fn(async () => ({ organizationId: 'org1' })),
    },
    organizationMembership: {
      findUnique: vi.fn(async () => state.orgMembership ?? null),
    },
    workspaceMembership: {
      findUnique: vi.fn(async () => state.wsMembership ?? null),
    },
  };
  const redis = {
    client: {
      get: vi.fn(async () => null),
      setex: vi.fn(async () => 'OK'),
      keys: vi.fn(async () => []),
      del: vi.fn(async () => 0),
    },
  };
  return new PermissionResolver(prisma as never, redis as never);
}

describe('PermissionResolver', () => {
  let resolver: Resolver;

  it('ORG_OWNER inherits WS_ADMIN even without a workspace membership', async () => {
    resolver = makeResolver({ orgMembership: { role: OrgRole.OWNER } });
    expect(await resolver.can('u1', 'campaign:write', { workspaceId: 'w1' })).toBe(true);
    expect(await resolver.can('u1', 'bisu:connect', { workspaceId: 'w1' })).toBe(true);
    expect(await resolver.can('u1', 'workspace:delete', { organizationId: 'org1' })).toBe(true);
  });

  it('ORG_ADMIN cannot touch billing permissions', async () => {
    resolver = makeResolver({ orgMembership: { role: OrgRole.ADMIN } });
    expect(await resolver.can('u2', 'billing:view', { organizationId: 'org1' })).toBe(false);
    expect(await resolver.can('u2', 'billing:manage', { organizationId: 'org1' })).toBe(false);
    expect(await resolver.can('u2', 'workspace:create', { organizationId: 'org1' })).toBe(true);
  });

  it('WS_VIEWER can read but not write', async () => {
    resolver = makeResolver({
      orgMembership: { role: OrgRole.MEMBER },
      wsMembership: { role: WorkspaceRole.VIEWER },
    });
    expect(await resolver.can('u3', 'campaign:read', { workspaceId: 'w1' })).toBe(true);
    expect(await resolver.can('u3', 'campaign:write', { workspaceId: 'w1' })).toBe(false);
    expect(await resolver.can('u3', 'report:export', { workspaceId: 'w1' })).toBe(true);
  });

  it('WS_MANAGER can write but not manage workspace', async () => {
    resolver = makeResolver({
      orgMembership: { role: OrgRole.MEMBER },
      wsMembership: { role: WorkspaceRole.MANAGER },
    });
    expect(await resolver.can('u4', 'campaign:write', { workspaceId: 'w1' })).toBe(true);
    expect(await resolver.can('u4', 'workspace:update', { workspaceId: 'w1' })).toBe(false);
    expect(await resolver.can('u4', 'bisu:connect', { workspaceId: 'w1' })).toBe(false);
  });

  it('non-member denies everything', async () => {
    resolver = makeResolver({});
    expect(await resolver.can('u5', 'campaign:read', { workspaceId: 'w1' })).toBe(false);
    expect(await resolver.can('u5', 'org:read', { organizationId: 'org1' })).toBe(false);
  });

  it('ORG_MEMBER can only read org', async () => {
    resolver = makeResolver({ orgMembership: { role: OrgRole.MEMBER } });
    expect(await resolver.can('u6', 'org:read', { organizationId: 'org1' })).toBe(true);
    expect(await resolver.can('u6', 'member:invite', { organizationId: 'org1' })).toBe(false);
  });
});
