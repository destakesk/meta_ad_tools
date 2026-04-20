/**
 * Permission key tuple — kept in lock-step with @metaflow/database's
 * PERMISSIONS catalogue. Frontend imports the type for autocomplete;
 * runtime resolution always goes through the API.
 */
export const PERMISSION_KEY_LIST = [
  // Organization-scoped
  'org:read',
  'org:update',
  'org:delete',
  'member:invite',
  'member:remove',
  'member:role:update',
  'workspace:create',
  'workspace:delete',
  'billing:view',
  'billing:manage',
  'audit:view',
  // Workspace-scoped
  'workspace:read',
  'workspace:update',
  'bisu:connect',
  'bisu:rotate',
  'bisu:disconnect',
  'adaccount:read',
  'adaccount:connect',
  'campaign:read',
  'campaign:write',
  'campaign:delete',
  'adset:write',
  'adset:delete',
  'ad:write',
  'ad:delete',
  'budget:edit',
  'creative:read',
  'creative:write',
  'creative:delete',
  'template:read',
  'template:write',
  'brandkit:read',
  'brandkit:write',
  'automation:read',
  'automation:write',
  'automation:enable',
  'abtest:read',
  'abtest:write',
  'insights:read',
  'report:read',
  'report:export',
  'ai:use',
  'lead:read',
  'lead:export',
] as const;

export type PermissionKey = (typeof PERMISSION_KEY_LIST)[number];

export type PermissionScope = 'organization' | 'workspace';

export function permissionScope(key: PermissionKey): PermissionScope {
  const orgPrefixes = new Set([
    'org',
    'member',
    'workspace:create',
    'workspace:delete',
    'billing',
    'audit',
  ]);
  const [head, ...rest] = key.split(':');
  const headWithSub = rest.length > 0 ? `${head ?? ''}:${rest[0] ?? ''}` : (head ?? '');
  if (orgPrefixes.has(head ?? '') || orgPrefixes.has(headWithSub)) {
    return 'organization';
  }
  return 'workspace';
}
