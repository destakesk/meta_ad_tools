import { Suspense } from 'react';

import { ResetPasswordClient } from './reset-password-client';

import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Şifre sıfırla • metaflow' };

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifre sıfırla</CardTitle>
        <CardDescription>
          Yeni şifrenizi belirleyin. Tüm aktif oturumlar sonlandırılacak.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <ResetPasswordClient />
        </Suspense>
      </CardContent>
    </Card>
  );
}
