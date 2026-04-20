import { Suspense } from 'react';

import { MfaSetupClient } from './mfa-setup-client';

import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'MFA kurulum • metaflow' };

export default function MfaSetupPage(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>İki adımlı doğrulama</CardTitle>
        <CardDescription>
          Hesabınızı korumak için zorunlu kurulum. Authenticator uygulamanızı bağlayın.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <MfaSetupClient />
        </Suspense>
      </CardContent>
    </Card>
  );
}
