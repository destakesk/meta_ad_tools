import { CampaignDetailClient } from './campaign-detail-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Kampanya detayı • metaflow' };

export default function CampaignDetailPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <CampaignDetailClient />
    </div>
  );
}
