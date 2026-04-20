import { Suspense } from 'react';

import { InviteAcceptClient } from './invite-accept-client';

import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Davet kabul • metaflow' };

export default function InviteAcceptPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Daveti kabul et</CardTitle>
            <CardDescription>Organizasyona katılmak için bir adım kaldı.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <InviteAcceptClient />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
