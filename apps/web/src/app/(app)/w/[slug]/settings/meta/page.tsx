import { MetaConnectionClient } from './meta-connection-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Meta bağlantısı • metaflow' };

export default function MetaSettingsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Meta Ads bağlantısı</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Workspace’i Meta Business hesabına bağla. Token’lar şifrelenmiş olarak saklanır; uygulama
          hiçbir zaman tarayıcıya gösterilmez.
        </p>
      </header>
      <MetaConnectionClient />
    </div>
  );
}
