import Link from 'next/link';
import { Suspense } from 'react';

import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Giriş yap • metaflow' };

export default function LoginPage(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Giriş yap</CardTitle>
        <CardDescription>Hesabınızla devam edin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <LoginForm />
        </Suspense>
        <div className="flex items-center justify-between text-sm">
          <Link
            href="/forgot-password"
            className="text-[hsl(var(--muted-foreground))] hover:underline"
          >
            Şifremi unuttum
          </Link>
          <Link href="/register" className="text-[hsl(var(--muted-foreground))] hover:underline">
            Hesap oluştur
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
