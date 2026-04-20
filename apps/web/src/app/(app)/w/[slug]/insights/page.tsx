import { InsightsClient } from './insights-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'İçgörüler • metaflow' };

export default function InsightsPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">İçgörüler</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Günlük performans raporu. Tarih aralığını seçip Meta’dan senkronize et, ardından tablo
          cache’ten gelen verileri gösterir.
        </p>
      </header>
      <InsightsClient />
    </div>
  );
}
