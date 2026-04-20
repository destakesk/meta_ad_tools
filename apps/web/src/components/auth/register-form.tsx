'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerRequestSchema } from '@metaflow/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { RegisterRequest } from '@metaflow/shared-types';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

interface Props {
  invitationToken?: string;
  defaultEmail?: string;
}

export function RegisterForm({ invitationToken, defaultEmail }: Props): React.ReactElement {
  const router = useRouter();
  const form = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      email: defaultEmail ?? '',
      password: '',
      fullName: '',
      ...(invitationToken !== undefined ? { invitationToken } : {}),
    },
  });

  const register = useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
  });

  const password = form.watch('password');

  const onSubmit = (values: RegisterRequest): void => {
    register.mutate(values, {
      onSuccess: () => {
        toast.success('Hesap oluşturuldu — e-postanızı doğrulayın');
        const target = new URL('/verify-email', window.location.origin);
        target.searchParams.set('email', values.email);
        router.push(target.pathname + target.search);
      },
    });
  };

  const apiError = register.error instanceof ApiError ? register.error : null;

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
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ad Soyad</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-posta</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  readOnly={defaultEmail !== undefined}
                  {...field}
                />
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
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <PasswordStrengthMeter password={password} />
              <FormDescription>En az 12 karakter, büyük + küçük harf + rakam.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={register.isPending} className="w-full">
          {register.isPending ? 'Hesap oluşturuluyor…' : 'Kayıt ol'}
        </Button>
      </form>
    </Form>
  );
}

function translateError(code: string, fallback: string): string {
  switch (code) {
    case 'email_already_registered':
      return 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
    case 'weak_password':
      return 'Şifre çok zayıf. Daha karmaşık ve tahmin edilmesi zor bir şifre seçin.';
    case 'invitation_invalid':
      return 'Davet bağlantısı geçersiz veya süresi dolmuş.';
    case 'rate_limit_exceeded':
      return 'Çok fazla istek yapıldı. Lütfen biraz bekleyin.';
    default:
      return fallback;
  }
}
