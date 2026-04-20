import { Suspense } from 'react';

import { MfaVerifyClient } from './mfa-verify-client';

import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'MFA doğrulama • metaflow' };

export default function MfaVerifyPage(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>İki adımlı doğrulama</CardTitle>
        <CardDescription>Authenticator uygulamanızdaki kodu girin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <MfaVerifyClient />
        </Suspense>
      </CardContent>
    </Card>
  );
}
