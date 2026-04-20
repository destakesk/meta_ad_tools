import { AdSetDetailClient } from './adset-detail-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ad set detayı • metaflow' };

export default function AdSetDetailPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <AdSetDetailClient />
    </div>
  );
}
