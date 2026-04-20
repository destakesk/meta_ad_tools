'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordRequestSchema } from '@metaflow/shared-types';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { ResetPasswordRequest } from '@metaflow/shared-types';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
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

export function ResetPasswordClient(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const form = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { token, newPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (body: ResetPasswordRequest) => authApi.resetPassword(body),
    onSuccess: () => {
      toast.success('Şifre sıfırlandı — yeniden giriş yapın');
      router.push('/login');
    },
  });

  const password = form.watch('newPassword');
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Sıfırlama bağlantısı geçersiz. Yeniden bağlantı talep edin.
          </AlertDescription>
        </Alert>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-[hsl(var(--muted-foreground))] hover:underline"
        >
          Yeniden gönder
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit((values) => {
            mutation.mutate(values);
          })(e);
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
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Yeni şifre</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <PasswordStrengthMeter password={password} />
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? 'Sıfırlanıyor…' : 'Şifreyi sıfırla'}
        </Button>
      </form>
    </Form>
  );
}

function translateError(code: string, fallback: string): string {
  switch (code) {
    case 'token_invalid':
    case 'token_expired':
      return 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı talep edin.';
    case 'weak_password':
      return 'Şifre çok zayıf. Daha güçlü bir şifre seçin.';
    default:
      return fallback;
  }
}
