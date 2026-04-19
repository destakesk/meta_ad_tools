/**
 * Role → permission mapping.
 *
 * Rule: ORG_OWNER is a superuser and gets every permission (both scopes).
 *       PermissionResolver in the API layer ALSO grants ORG_OWNER implicit
 *       WS_ADMIN in every workspace of their org even without an explicit
 *       WorkspaceMembership row.
 */
import { PERMISSIONS } from './permissions';

const ALL_KEYS = PERMISSIONS.map((p) => p.key);
const WORKSPACE_WRITE_KEYS = [
  'workspace:read',
  'bisu:connect',
  'bisu:rotate',
  'bisu:disconnect',
  'adaccount:read',
  'adaccount:connect',
  'campaign:read',
  'campaign:write',
  'campaign:delete',
  'adset:write',
  'ad:write',
  'budget:edit',
  'creative:read',
  'creative:write',
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
];

const WS_ADMIN_KEYS = ['workspace:update', ...WORKSPACE_WRITE_KEYS];

const WS_MANAGER_KEYS = [
  'workspace:read',
  'campaign:read',
  'campaign:write',
  'adset:write',
  'ad:write',
  'budget:edit',
  'creative:read',
  'creative:write',
  'template:read',
  'template:write',
  'brandkit:read',
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
];

const WS_VIEWER_KEYS = [
  'workspace:read',
  'campaign:read',
  'adaccount:read',
  'creative:read',
  'template:read',
  'brandkit:read',
  'automation:read',
  'abtest:read',
  'insights:read',
  'report:read',
  'report:export',
  'lead:read',
];

const ORG_ADMIN_KEYS = ALL_KEYS.filter((k) => !['billing:view', 'billing:manage'].includes(k));

const ORG_MEMBER_KEYS = ['org:read'];

export const ROLE_NAMES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'ORG_MEMBER',
  'WS_ADMIN',
  'WS_MANAGER',
  'WS_VIEWER',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_PERMISSIONS: Record<RoleName, readonly string[]> = {
  ORG_OWNER: ALL_KEYS,
  ORG_ADMIN: ORG_ADMIN_KEYS,
  ORG_MEMBER: ORG_MEMBER_KEYS,
  WS_ADMIN: WS_ADMIN_KEYS,
  WS_MANAGER: WS_MANAGER_KEYS,
  WS_VIEWER: WS_VIEWER_KEYS,
};
