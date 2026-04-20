import { CampaignsClient } from './campaigns-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Kampanyalar • metaflow' };

export default function CampaignsPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">Kampanyalar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Bu workspace’in Meta hesaplarındaki kampanyalar. Listeyi senkronize ederek en güncel hâli
          DB cache’ine çekebilirsin.
        </p>
      </header>
      <CampaignsClient />
    </div>
  );
}
