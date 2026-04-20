import { Suspense } from 'react';

import { MetaCallbackClient } from './meta-callback-client';

import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Meta bağlantısı tamamlanıyor • metaflow' };

export default function MetaCallbackPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Meta bağlantısı tamamlanıyor</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <MetaCallbackClient />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
