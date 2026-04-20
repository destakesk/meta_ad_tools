'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { mfaSetupRequestSchema } from '@metaflow/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { MfaSetupRequest } from '@metaflow/shared-types';

import { BackupCodesDisplay } from '@/components/auth/backup-codes-display';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/use-auth-store';

interface Props {
  mfaSetupToken: string;
  redirect?: string;
}

export function MfaSetup({ mfaSetupToken, redirect }: Props): React.ReactElement {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setMe = useAuthStore((s) => s.setMe);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const init = useQuery({
    queryKey: ['mfa-setup-init', mfaSetupToken],
    queryFn: () => authApi.mfaSetupInit(mfaSetupToken),
    retry: false,
    staleTime: Infinity,
  });

  const form = useForm<MfaSetupRequest>({
    resolver: zodResolver(mfaSetupRequestSchema),
    defaultValues: { mfaSetupToken, totpCode: '' },
  });

  const setup = useMutation({
    mutationFn: (body: MfaSetupRequest) => authApi.mfaSetup(body),
    onSuccess: async ({ accessToken, backupCodes: codes }) => {
      setAccessToken(accessToken);
      const me = await authApi.me();
      setMe(me);
      setBackupCodes(codes);
    },
  });

  const onSubmit = (values: MfaSetupRequest): void => {
    setup.mutate(values);
  };

  if (backupCodes) {
    return (
      <BackupCodesDisplay
        codes={backupCodes}
        onAcknowledge={() => {
          toast.success('İki adımlı doğrulama etkinleştirildi');
          router.push(redirect ?? '/');
          router.refresh();
        }}
      />
    );
  }

  if (init.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="mx-auto h-48 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (init.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          MFA kurulum oturumu geçersiz ya da süresi dolmuş. Lütfen yeniden giriş yapın.
        </AlertDescription>
      </Alert>
    );
  }

  const { qrCodeDataUrl, secret } = init.data;
  const apiError = setup.error instanceof ApiError ? setup.error : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Google Authenticator, 1Password, Authy gibi bir uygulamada QR kodu tarayın veya gizli
        anahtarı manuel olarak girin.
      </p>

      <div className="flex justify-center rounded-md border bg-white p-4">
        <Image src={qrCodeDataUrl} alt="MFA QR" width={192} height={192} unoptimized />
      </div>

      <div className="flex items-center gap-2 rounded-md border bg-[hsl(var(--muted))] px-3 py-2">
        <code className="flex-1 truncate font-mono text-sm">{secret}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            void navigator.clipboard.writeText(secret).then(() => {
              toast.success('Anahtar kopyalandı');
            });
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => {
            void form.handleSubmit(onSubmit)(e);
          }}
          className="space-y-3"
          noValidate
        >
          {apiError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {translateError(apiError.body.code, apiError.body.message)}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField
            control={form.control}
            name="totpCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>6 haneli kod</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={setup.isPending} className="w-full">
            {setup.isPending ? 'Doğrulanıyor…' : 'Doğrula ve etkinleştir'}
          </Button>
        </form>
      </Form>
    </div>
  );
}

function translateError(code: string, fallback: string): string {
  switch (code) {
    case 'mfa_invalid_code':
    case 'invalid_totp':
      return 'Kod hatalı. Yeni bir kod oluşmasını bekleyip tekrar deneyin.';
    case 'mfa_setup_token_invalid':
    case 'mfa_setup_expired':
      return 'Kurulum oturumu doldu. Lütfen yeniden giriş yapın.';
    default:
      return fallback;
  }
}
