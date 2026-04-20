import { CreativesClient } from './creatives-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Creative kütüphanesi • metaflow' };

export default function CreativesPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <CreativesClient />
    </div>
  );
}
