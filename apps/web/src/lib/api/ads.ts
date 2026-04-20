import { api } from './client';

import type {
  Ad,
  AdInsightListResponse,
  AdListResponse,
  AdSyncResponse,
  CreateAdRequest,
  InsightSyncRequest,
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

  insights: (slug: string, id: string, from: string, to: string) =>
    api.get<AdInsightListResponse>(
      `/api/workspaces/${slug}/ads/${id}/insights?from=${from}&to=${to}`,
    ),

  syncInsights: (slug: string, id: string, body: InsightSyncRequest) =>
    api.post<{ syncedCount: number }>(`/api/workspaces/${slug}/ads/${id}/insights/sync`, body),
};
