import { api } from './client';

import type {
  CampaignListResponse,
  CampaignSyncResponse,
  CreateCampaignRequest,
  InsightListResponse,
  InsightSyncRequest,
  UpdateCampaignRequest,
} from '@metaflow/shared-types';

interface CampaignDetail {
  campaign: CampaignListResponse['campaigns'][number];
}

export const campaignsApi = {
  list: (slug: string) => api.get<CampaignListResponse>(`/api/workspaces/${slug}/campaigns`),

  sync: (slug: string) => api.post<CampaignSyncResponse>(`/api/workspaces/${slug}/campaigns/sync`),

  detail: (slug: string, id: string) =>
    api.get<CampaignDetail>(`/api/workspaces/${slug}/campaigns/${id}`),

  campaignInsights: (slug: string, id: string, from: string, to: string) =>
    api.get<InsightListResponse>(
      `/api/workspaces/${slug}/campaigns/${id}/insights?from=${from}&to=${to}`,
    ),

  create: (slug: string, body: CreateCampaignRequest) =>
    api.post<CampaignDetail>(`/api/workspaces/${slug}/campaigns`, body),

  update: (slug: string, id: string, body: UpdateCampaignRequest) =>
    api.patch<CampaignDetail>(`/api/workspaces/${slug}/campaigns/${id}`, body),

  delete: (slug: string, id: string) =>
    api.delete<{ ok: true }>(`/api/workspaces/${slug}/campaigns/${id}`),
};

export const insightsApi = {
  list: (slug: string, from: string, to: string) =>
    api.get<InsightListResponse>(`/api/workspaces/${slug}/insights?from=${from}&to=${to}`),

  sync: (slug: string, body: InsightSyncRequest) =>
    api.post<{ syncedCount: number }>(`/api/workspaces/${slug}/insights/sync`, body),
};
