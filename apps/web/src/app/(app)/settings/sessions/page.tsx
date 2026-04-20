import { SessionsClient } from './sessions-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Oturumlar • metaflow' };

export default function SessionsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Aktif oturumlar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Şu anda hesabına bağlı olan cihazlar. Mevcut cihaz dışındaki oturumları
          sonlandırabilirsin.
        </p>
      </header>
      <SessionsClient />
    </div>
  );
}
