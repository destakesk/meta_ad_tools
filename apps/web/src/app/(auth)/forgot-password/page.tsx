'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema } from '@metaflow/shared-types';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { ForgotPasswordRequest } from '@metaflow/shared-types';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

export default function ForgotPasswordPage(): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: (body: ForgotPasswordRequest) => authApi.forgotPassword(body),
    onSettled: () => {
      setSubmitted(true);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifremi unuttum</CardTitle>
        <CardDescription>
          Hesabınızın e-posta adresini girin. Sıfırlama bağlantısını size göndereceğiz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {submitted ? (
          <Alert variant="success">
            <AlertTitle>Kontrol edin</AlertTitle>
            <AlertDescription>
              Eğer bu e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderildi. Bağlantı 1 saat
              boyunca geçerlidir. Spam klasörünü de kontrol edin.
            </AlertDescription>
          </Alert>
        ) : (
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
              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
              </Button>
            </form>
          </Form>
        )}

        <div className="text-center text-sm">
          <Link href="/login" className="text-[hsl(var(--muted-foreground))] hover:underline">
            Giriş sayfasına dön
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
