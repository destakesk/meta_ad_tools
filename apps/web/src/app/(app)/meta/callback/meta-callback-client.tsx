'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ApiError } from '@/lib/api/client';
import { metaApi } from '@/lib/api/meta';

export function MetaCallbackClient(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorReason = params.get('error_reason');
  const ranRef = useRef(false);

  const callback = useMutation({
    mutationFn: () => metaApi.callback({ code: code ?? '', state: state ?? '' }),
    onSuccess: ({ workspaceSlug }) => {
      router.replace(`/w/${workspaceSlug}/settings/meta`);
      router.refresh();
    },
  });

  useEffect(() => {
    if (ranRef.current) return;
    if (!code || !state) return;
    ranRef.current = true;
    callback.mutate();
  }, [code, state, callback]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Meta tarafından izin verilmedi</AlertTitle>
          <AlertDescription>{errorReason ?? error}</AlertDescription>
        </Alert>
        <Link
          href="/"
          className="block text-center text-sm text-[hsl(var(--muted-foreground))] hover:underline"
        >
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  if (!code || !state) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Geri dönüş bağlantısı eksik (code veya state yok). İşlemi baştan başlat.
        </AlertDescription>
      </Alert>
    );
  }

  if (callback.isError) {
    const message =
      callback.error instanceof ApiError ? callback.error.body.message : 'Bilinmeyen hata';
    return (
      <Alert variant="destructive">
        <AlertTitle>Bağlantı tamamlanamadı</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <p className="text-sm text-[hsl(var(--muted-foreground))]">Token alınıyor ve kaydediliyor…</p>
  );
}
