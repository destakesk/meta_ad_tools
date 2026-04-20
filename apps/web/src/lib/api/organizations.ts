import { api } from './client';

import type {
  CreateWorkspaceRequest,
  CurrentOrgResponse,
  InviteMemberRequest,
  OrganizationMembersResponse,
  UpdateOrganizationRequest,
  Workspace,
} from '@metaflow/shared-types';

export const orgsApi = {
  current: () => api.get<CurrentOrgResponse>('/api/organizations/current'),

  listMembers: (orgId: string) =>
    api.get<OrganizationMembersResponse>(`/api/organizations/${orgId}/members`),

  invite: (orgId: string, body: InviteMemberRequest) =>
    api.post<{ invitationId: string; expiresAt: string }>(
      `/api/organizations/${orgId}/members/invite`,
      body,
    ),

  createWorkspace: (orgId: string, body: CreateWorkspaceRequest) =>
    api.post<Workspace>(`/api/organizations/${orgId}/workspaces`, body),

  update: (orgId: string, body: UpdateOrganizationRequest) =>
    api.patch<{ id: string; name: string; slug: string; createdAt: string; updatedAt: string }>(
      `/api/organizations/${orgId}`,
      body,
    ),
};
