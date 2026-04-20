import { OrganizationClient } from './organization-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Organizasyon • metaflow' };

export default function OrganizationPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Organizasyon</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Organizasyon adı ve workspace’ler.
        </p>
      </header>
      <OrganizationClient />
    </div>
  );
}
