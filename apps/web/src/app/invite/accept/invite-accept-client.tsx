'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import type { InvitationPreview } from '@metaflow/shared-types';

import { RegisterForm } from '@/components/auth/register-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-auth';

export function InviteAcceptClient(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const currentUser = useCurrentUser();
  const [needsRegister, setNeedsRegister] = useState(false);

  const preview = useQuery<InvitationPreview>({
    queryKey: ['invitation-preview', token],
    queryFn: () => api.post<InvitationPreview>('/api/invitations/preview', { token }),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post<{ ok: true }>('/api/invitations/accept', { token }),
    onSuccess: () => {
      toast.success('Davet kabul edildi');
      router.push('/');
      router.refresh();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.body.code === 'user_required') {
        setNeedsRegister(true);
      }
    },
  });

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Davet bağlantısı eksik veya bozulmuş.</AlertDescription>
      </Alert>
    );
  }

  if (preview.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (preview.isError) {
    const code = preview.error instanceof ApiError ? preview.error.body.code : 'invitation_invalid';
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Davet geçersiz</AlertTitle>
          <AlertDescription>
            {code === 'token_expired'
              ? 'Bu davet bağlantısının süresi dolmuş.'
              : 'Bu davet bağlantısı geçerli değil ya da daha önce kullanılmış.'}
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

  const inv = preview.data;

  if (needsRegister) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Önce hesap oluşturun</AlertTitle>
          <AlertDescription>
            {inv.email} adresi için bir hesap bulunmuyor. Aşağıdaki formu doldurun; kayıt sonrası
            davet otomatik kabul edilir.
          </AlertDescription>
        </Alert>
        <RegisterForm invitationToken={token} defaultEmail={inv.email} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-[hsl(var(--muted-foreground))]">Organizasyon:</span>{' '}
          <strong>{inv.organizationName}</strong>
        </div>
        <div>
          <span className="text-[hsl(var(--muted-foreground))]">Davet eden:</span> {inv.inviterName}
        </div>
        <div>
          <span className="text-[hsl(var(--muted-foreground))]">Rol:</span> {inv.role}
        </div>
        <div>
          <span className="text-[hsl(var(--muted-foreground))]">E-posta:</span> {inv.email}
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          Son geçerlilik: {new Date(inv.expiresAt).toLocaleString('tr-TR')}
        </div>
      </div>

      {currentUser && currentUser.email !== inv.email ? (
        <Alert variant="warning">
          <AlertTitle>Farklı bir hesapla giriş yapmışsınız</AlertTitle>
          <AlertDescription>
            Bu davet {inv.email} için. Önce çıkış yapıp doğru hesapla giriş yapın.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        disabled={accept.isPending || (currentUser !== null && currentUser.email !== inv.email)}
        onClick={() => {
          accept.mutate();
        }}
        className="w-full"
      >
        {accept.isPending ? 'Kabul ediliyor…' : 'Daveti kabul et'}
      </Button>

      {!currentUser ? (
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
          Devam ederseniz, mevcut hesap yoksa otomatik olarak yeni bir hesap oluşturma adımına
          geçilir.
        </p>
      ) : null}
    </div>
  );
}
