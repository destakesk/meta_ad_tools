import { z } from 'zod';

import { workspaceSchema } from './workspace';

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const currentOrgResponseSchema = z.object({
  organization: organizationSchema,
  userRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  workspaces: z.array(workspaceSchema),
});
export type CurrentOrgResponse = z.infer<typeof currentOrgResponseSchema>;

export const inviteRoleSchema = z.enum([
  'ORG_ADMIN',
  'ORG_MEMBER',
  'WS_ADMIN',
  'WS_MANAGER',
  'WS_VIEWER',
]);
export type InviteRole = z.infer<typeof inviteRoleSchema>;

export const inviteMemberRequestSchema = z.object({
  email: z.string().email(),
  role: inviteRoleSchema,
  workspaceId: z.string().optional(),
});
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;
