'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { mfaVerifyRequestSchema } from '@metaflow/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { MfaVerifyRequest } from '@metaflow/shared-types';

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
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/use-auth-store';

interface Props {
  mfaChallengeToken: string;
  redirect?: string;
}

export function MfaVerify({ mfaChallengeToken, redirect }: Props): React.ReactElement {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setMe = useAuthStore((s) => s.setMe);
  const [useBackup, setUseBackup] = useState(false);

  const form = useForm<MfaVerifyRequest>({
    resolver: zodResolver(mfaVerifyRequestSchema),
    defaultValues: { mfaChallengeToken, code: '' },
  });

  const verify = useMutation({
    mutationFn: (body: MfaVerifyRequest) => authApi.mfaVerify(body),
    onSuccess: async ({ accessToken }) => {
      setAccessToken(accessToken);
      const me = await authApi.me();
      setMe(me);
      toast.success('Giriş yapıldı');
      router.push(redirect ?? '/');
      router.refresh();
    },
  });

  const onSubmit = (values: MfaVerifyRequest): void => {
    verify.mutate(values);
  };

  const apiError = verify.error instanceof ApiError ? verify.error : null;

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-4"
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
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{useBackup ? 'Yedek kod' : '6 haneli kod'}</FormLabel>
              <FormControl>
                <Input
                  inputMode={useBackup ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  placeholder={useBackup ? 'XXXXX-XXXXX' : '123456'}
                  maxLength={useBackup ? 11 : 6}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={verify.isPending} className="w-full">
          {verify.isPending ? 'Doğrulanıyor…' : 'Doğrula'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setUseBackup((v) => !v);
            form.setValue('code', '');
          }}
          className="block w-full text-center text-sm text-[hsl(var(--muted-foreground))] hover:underline"
        >
          {useBackup ? 'Authenticator koduna dön' : 'Bunun yerine yedek kod kullan'}
        </button>
      </form>
    </Form>
  );
}

function translateError(code: string, fallback: string): string {
  switch (code) {
    case 'mfa_invalid_code':
    case 'invalid_totp':
    case 'invalid_backup_code':
      return 'Kod hatalı. Lütfen tekrar deneyin.';
    case 'mfa_locked':
      return 'Çok fazla başarısız deneme. Birkaç dakika bekleyip yeniden deneyin.';
    case 'mfa_challenge_invalid':
    case 'mfa_challenge_expired':
      return 'Doğrulama oturumu doldu. Lütfen yeniden giriş yapın.';
    default:
      return fallback;
  }
}
