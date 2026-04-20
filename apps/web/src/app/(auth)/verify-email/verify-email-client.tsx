'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type Status = 'idle' | 'verifying' | 'success' | 'error';

export function VerifyEmailClient(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const email = params.get('email');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ranRef = useRef(false);

  const resend = useMutation({
    mutationFn: (e: string) => authApi.forgotPassword({ email: e }),
  });

  useEffect(() => {
    if (!token || ranRef.current) return;
    ranRef.current = true;
    setStatus('verifying');
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        toast.success('E-posta doğrulandı');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      })
      .catch((err: unknown) => {
        setStatus('error');
        if (err instanceof ApiError) {
          setErrorMsg(
            err.body.code === 'token_invalid' || err.body.code === 'token_expired'
              ? 'Doğrulama bağlantısı geçersiz veya süresi dolmuş.'
              : err.body.message,
          );
        } else {
          setErrorMsg('Bilinmeyen bir hata oluştu.');
        }
      });
  }, [token, router]);

  if (status === 'verifying') {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Doğrulanıyor…</p>;
  }

  if (status === 'success') {
    return (
      <Alert variant="success">
        <AlertTitle>Doğrulandı</AlertTitle>
        <AlertDescription>Giriş sayfasına yönlendiriliyorsunuz…</AlertDescription>
      </Alert>
    );
  }

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Doğrulama başarısız</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
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

  return (
    <div className="space-y-3 text-sm text-[hsl(var(--muted-foreground))]">
      <p>
        {email ?? 'E-posta adresinize'} bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayarak
        hesabınızı etkinleştirin.
      </p>
      <p>Bağlantıyı görmediyseniz spam klasörünü kontrol edin veya yeniden gönderin.</p>
      {email ? (
        <Button
          type="button"
          variant="outline"
          disabled={resend.isPending}
          onClick={() => {
            resend.mutate(email, {
              onSuccess: () => {
                toast.success('Doğrulama e-postası tekrar gönderildi');
              },
            });
          }}
          className="w-full"
        >
          {resend.isPending ? 'Gönderiliyor…' : 'Yeniden gönder'}
        </Button>
      ) : null}
    </div>
  );
}
