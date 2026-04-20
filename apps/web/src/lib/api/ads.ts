import { api } from './client';

import type {
  Ad,
  AdListResponse,
  AdSyncResponse,
  CreateAdRequest,
  UpdateAdRequest,
} from '@metaflow/shared-types';

interface AdDetail {
  ad: Ad;
}

export const adsApi = {
  listForAdSet: (slug: string, adsetId: string) =>
    api.get<AdListResponse>(`/api/workspaces/${slug}/adsets/${adsetId}/ads`),

  sync: (slug: string, adsetId: string) =>
    api.post<AdSyncResponse>(`/api/workspaces/${slug}/adsets/${adsetId}/ads/sync`),

  create: (slug: string, adsetId: string, body: Omit<CreateAdRequest, 'adsetId'>) =>
    api.post<AdDetail>(`/api/workspaces/${slug}/adsets/${adsetId}/ads`, body),

  detail: (slug: string, id: string) => api.get<AdDetail>(`/api/workspaces/${slug}/ads/${id}`),

  update: (slug: string, id: string, body: UpdateAdRequest) =>
    api.patch<AdDetail>(`/api/workspaces/${slug}/ads/${id}`, body),

  delete: (slug: string, id: string) =>
    api.delete<{ ok: true }>(`/api/workspaces/${slug}/ads/${id}`),
};
