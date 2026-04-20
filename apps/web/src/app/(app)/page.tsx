import { DashboardClient } from './dashboard-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ana ekran • metaflow' };

export default function DashboardPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <DashboardClient />
    </div>
  );
}
