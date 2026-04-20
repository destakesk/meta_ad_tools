import { api } from './client';

import type {
  CampaignListResponse,
  CampaignSyncResponse,
  InsightListResponse,
  InsightSyncRequest,
} from '@metaflow/shared-types';

export const campaignsApi = {
  list: (slug: string) => api.get<CampaignListResponse>(`/api/workspaces/${slug}/campaigns`),

  sync: (slug: string) => api.post<CampaignSyncResponse>(`/api/workspaces/${slug}/campaigns/sync`),

  detail: (slug: string, id: string) =>
    api.get<{ campaign: CampaignListResponse['campaigns'][number] }>(
      `/api/workspaces/${slug}/campaigns/${id}`,
    ),

  campaignInsights: (slug: string, id: string, from: string, to: string) =>
    api.get<InsightListResponse>(
      `/api/workspaces/${slug}/campaigns/${id}/insights?from=${from}&to=${to}`,
    ),
};

export const insightsApi = {
  list: (slug: string, from: string, to: string) =>
    api.get<InsightListResponse>(`/api/workspaces/${slug}/insights?from=${from}&to=${to}`),

  sync: (slug: string, body: InsightSyncRequest) =>
    api.post<{ syncedCount: number }>(`/api/workspaces/${slug}/insights/sync`, body),
};
