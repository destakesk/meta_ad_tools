import { Suspense } from 'react';

import { VerifyEmailClient } from './verify-email-client';

import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'E-posta doğrulama • metaflow' };

export default function VerifyEmailPage(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>E-posta doğrulama</CardTitle>
        <CardDescription>
          Gönderdiğimiz bağlantıdaki tokenı doğrulayın. 24 saat içinde geçerli.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <VerifyEmailClient />
        </Suspense>
      </CardContent>
    </Card>
  );
}
