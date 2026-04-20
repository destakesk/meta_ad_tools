import { AdDetailClient } from './ad-detail-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reklam detayı • metaflow' };

export default function AdDetailPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <AdDetailClient />
    </div>
  );
}
