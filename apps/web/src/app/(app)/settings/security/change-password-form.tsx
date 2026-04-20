'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema } from '@metaflow/shared-types';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { ChangePasswordRequest } from '@metaflow/shared-types';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export function ChangePasswordForm(): React.ReactElement {
  const form = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (body: ChangePasswordRequest) => authApi.changePassword(body),
    onSuccess: () => {
      toast.success('Şifre değiştirildi — diğer cihazlardaki oturumlar sonlandırıldı');
      form.reset({ currentPassword: '', newPassword: '' });
    },
  });

  const newPassword = form.watch('newPassword');
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifre değiştir</CardTitle>
        <CardDescription>
          Şifre değişikliği bu cihaz dışındaki tüm oturumları sonlandırır.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  {apiError.body.code === 'wrong_password'
                    ? 'Mevcut şifre hatalı.'
                    : apiError.body.message}
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mevcut şifre</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Yeni şifre</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <PasswordStrengthMeter password={newPassword} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Güncelleniyor…' : 'Şifreyi değiştir'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
