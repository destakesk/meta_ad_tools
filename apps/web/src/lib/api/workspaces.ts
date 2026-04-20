import { api } from './client';

import type { UpdateWorkspaceRequest, Workspace, WorkspaceResponse } from '@metaflow/shared-types';

export const workspacesApi = {
  get: (slug: string) => api.get<WorkspaceResponse>(`/api/workspaces/${slug}`),

  update: (slug: string, body: UpdateWorkspaceRequest) =>
    api.patch<Workspace>(`/api/workspaces/${slug}`, body),
};
