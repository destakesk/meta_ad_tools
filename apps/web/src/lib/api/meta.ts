import { api } from './client';

import type {
  MetaAdAccountListResponse,
  MetaConnectionResponse,
  OAuthCallbackRequest,
  OAuthInitResponse,
} from '@metaflow/shared-types';

export const metaApi = {
  current: (slug: string) => api.get<MetaConnectionResponse>(`/api/workspaces/${slug}/meta`),

  initConnect: (slug: string) =>
    api.post<OAuthInitResponse>(`/api/workspaces/${slug}/meta/connect/init`),

  callback: (body: OAuthCallbackRequest) =>
    api.post<MetaConnectionResponse & { workspaceSlug: string }>(
      '/api/meta/connect/callback',
      body,
    ),

  rotate: (slug: string, connectionId: string) =>
    api.post<MetaConnectionResponse>(`/api/workspaces/${slug}/meta/${connectionId}/rotate`),

  disconnect: (slug: string, connectionId: string) =>
    api.delete<{ ok: true }>(`/api/workspaces/${slug}/meta/${connectionId}`),

  syncAdAccounts: (slug: string, connectionId: string) =>
    api.post<MetaAdAccountListResponse>(
      `/api/workspaces/${slug}/meta/${connectionId}/ad-accounts/sync`,
    ),

  listAdAccounts: (slug: string, connectionId: string) =>
    api.get<MetaAdAccountListResponse>(`/api/workspaces/${slug}/meta/${connectionId}/ad-accounts`),
};
