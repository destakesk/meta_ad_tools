'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema } from '@metaflow/shared-types';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { LoginRequest, LoginResponse } from '@metaflow/shared-types';

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
import { ApiError } from '@/lib/api/client';
import { useLogin } from '@/lib/auth/use-auth';

const REDIRECT_FALLBACK = '/';

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? REDIRECT_FALLBACK;
  const login = useLogin();

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginRequest): void => {
    login.mutate(values, {
      onSuccess: (res: LoginResponse) => {
        if (res.step === 'success') {
          toast.success('Giriş yapıldı');
          router.push(redirect);
          router.refresh();
        } else if (res.step === 'mfa_challenge') {
          const url = new URL('/mfa/verify', window.location.origin);
          url.searchParams.set('token', res.mfaChallengeToken);
          if (redirect !== REDIRECT_FALLBACK) url.searchParams.set('redirect', redirect);
          router.push(url.pathname + url.search);
        } else {
          const url = new URL('/mfa/setup', window.location.origin);
          url.searchParams.set('token', res.mfaSetupToken);
          if (redirect !== REDIRECT_FALLBACK) url.searchParams.set('redirect', redirect);
          router.push(url.pathname + url.search);
        }
      },
    });
  };

  const apiError = login.error instanceof ApiError ? login.error : null;

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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-posta</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Şifre</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Button>
      </form>
    </Form>
  );
}

function translateError(code: string, fallback: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'E-posta veya şifre hatalı.';
    case 'email_not_verified':
      return 'E-posta adresinizi doğrulamadan giriş yapamazsınız. Doğrulama bağlantısını gelen kutunuzdan kontrol edin.';
    case 'account_locked':
      return 'Hesap çok sayıda başarısız denemeden sonra geçici olarak kilitlendi. Birkaç dakika sonra tekrar deneyin.';
    case 'rate_limit_exceeded':
      return 'Çok fazla istek yapıldı. Lütfen biraz bekleyin.';
    default:
      return fallback;
  }
}
