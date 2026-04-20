import { MembersClient } from './members-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Üyeler • metaflow' };

export default function MembersPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Üyeler</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Organizasyon üyeleri ve davet gönderme.
        </p>
      </header>
      <MembersClient />
    </div>
  );
}
