import { api } from './client';

import type {
  CreateCreativeRequest,
  Creative,
  CreativeListResponse,
  CreativeSyncResponse,
} from '@metaflow/shared-types';

interface CreativeDetail {
  creative: Creative;
}

export const creativesApi = {
  listForWorkspace: (slug: string) =>
    api.get<CreativeListResponse>(`/api/workspaces/${slug}/creatives`),

  listForAdAccount: (slug: string, adAccountId: string) =>
    api.get<CreativeListResponse>(`/api/workspaces/${slug}/adaccounts/${adAccountId}/creatives`),

  syncForAdAccount: (slug: string, adAccountId: string) =>
    api.post<CreativeSyncResponse>(
      `/api/workspaces/${slug}/adaccounts/${adAccountId}/creatives/sync`,
    ),

  detail: (slug: string, id: string) =>
    api.get<CreativeDetail>(`/api/workspaces/${slug}/creatives/${id}`),

  create: (slug: string, body: CreateCreativeRequest) =>
    api.post<CreativeDetail>(`/api/workspaces/${slug}/creatives`, body),

  delete: (slug: string, id: string) =>
    api.delete<{ ok: true }>(`/api/workspaces/${slug}/creatives/${id}`),
};
