'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileRequestSchema } from '@metaflow/shared-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { UpdateProfileRequest } from '@metaflow/shared-types';

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
import { useCurrentUser } from '@/lib/auth/use-auth';
import { useAuthStore } from '@/stores/use-auth-store';

interface FormValues {
  fullName: string;
  avatarUrl: string;
}

export function ProfileForm(): React.ReactElement {
  const user = useCurrentUser();
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(updateProfileRequestSchema),
    defaultValues: { fullName: '', avatarUrl: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ fullName: user.fullName, avatarUrl: user.avatarUrl ?? '' });
    }
  }, [user, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: UpdateProfileRequest = { fullName: values.fullName };
      body.avatarUrl = values.avatarUrl.length > 0 ? values.avatarUrl : null;
      return authApi.updateMe(body);
    },
    onSuccess: async () => {
      toast.success('Profil güncellendi');
      const me = await authApi.me();
      useAuthStore.getState().setMe(me);
      void qc.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
  });

  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

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
            <AlertDescription>{apiError.body.message}</AlertDescription>
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
          name="avatarUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://…" {...field} />
              </FormControl>
              <FormDescription>İsteğe bağlı. Boş bırakırsan mevcut avatar silinir.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-1 rounded-md border bg-[hsl(var(--muted))] px-4 py-3 text-sm">
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">E-posta:</span>{' '}
            {user?.email ?? '—'}
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Üyelik:</span>{' '}
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : '—'}
          </div>
        </div>

        <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
          {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </form>
    </Form>
  );
}
