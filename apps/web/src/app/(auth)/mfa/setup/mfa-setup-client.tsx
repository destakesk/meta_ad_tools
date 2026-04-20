'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { MfaSetup } from '@/components/auth/mfa-setup';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MfaSetupClient(): React.ReactElement {
  const params = useSearchParams();
  const token = params.get('token');
  const redirect = params.get('redirect') ?? undefined;

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Kurulum oturumu bulunamadı. Lütfen yeniden giriş yapın.
          </AlertDescription>
        </Alert>
        <Link
          href="/login"
          className="block text-center text-sm text-[hsl(var(--muted-foreground))] hover:underline"
        >
          Giriş sayfasına dön
        </Link>
      </div>
    );
  }

  return <MfaSetup mfaSetupToken={token} {...(redirect !== undefined ? { redirect } : {})} />;
}
