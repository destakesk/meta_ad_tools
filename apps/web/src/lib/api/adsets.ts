import { api } from './client';

import type {
  AdSet,
  AdSetListResponse,
  AdSetSyncResponse,
  CreateAdSetRequest,
  UpdateAdSetRequest,
} from '@metaflow/shared-types';

interface AdSetDetail {
  adSet: AdSet;
}

export const adSetsApi = {
  listForCampaign: (slug: string, campaignId: string) =>
    api.get<AdSetListResponse>(`/api/workspaces/${slug}/campaigns/${campaignId}/adsets`),

  sync: (slug: string, campaignId: string) =>
    api.post<AdSetSyncResponse>(`/api/workspaces/${slug}/campaigns/${campaignId}/adsets/sync`),

  create: (slug: string, campaignId: string, body: Omit<CreateAdSetRequest, 'campaignId'>) =>
    api.post<AdSetDetail>(`/api/workspaces/${slug}/campaigns/${campaignId}/adsets`, {
      ...body,
      campaignId,
    }),

  detail: (slug: string, id: string) =>
    api.get<AdSetDetail>(`/api/workspaces/${slug}/adsets/${id}`),

  update: (slug: string, id: string, body: UpdateAdSetRequest) =>
    api.patch<AdSetDetail>(`/api/workspaces/${slug}/adsets/${id}`, body),

  delete: (slug: string, id: string) =>
    api.delete<{ ok: true }>(`/api/workspaces/${slug}/adsets/${id}`),
};
