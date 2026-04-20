'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateWorkspaceRequestSchema } from '@metaflow/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { UpdateWorkspaceRequest } from '@metaflow/shared-types';

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
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { workspacesApi } from '@/lib/api/workspaces';
import { useCan } from '@/lib/auth/use-can';

export default function WorkspaceSettingsPage(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const qc = useQueryClient();
  const canUpdate = useCan('workspace:update');

  const ws = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
    staleTime: 30_000,
  });

  const form = useForm<UpdateWorkspaceRequest>({
    resolver: zodResolver(updateWorkspaceRequestSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (ws.data) form.reset({ name: ws.data.workspace.name });
  }, [ws.data, form]);

  const update = useMutation({
    mutationFn: (body: UpdateWorkspaceRequest) => workspacesApi.update(slug, body),
    onSuccess: () => {
      toast.success('Workspace güncellendi');
      void qc.invalidateQueries({ queryKey: ['workspace', slug] });
      void qc.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
  });

  if (ws.isPending)
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Skeleton className="h-48" />
      </div>
    );

  if (ws.isError) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Alert variant="destructive">
          <AlertDescription>Workspace yüklenemedi.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const apiError = update.error instanceof ApiError ? update.error : null;
  const w = ws.data.workspace;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">{w.name} ayarları</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Slug değiştirilemez. Yalnızca görünen ad güncellenebilir.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Genel</CardTitle>
          <CardDescription>Workspace adı.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={(e) => {
                void form.handleSubmit((values) => {
                  update.mutate(values);
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad</FormLabel>
                    <FormControl>
                      <Input disabled={!canUpdate} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                <div>Slug: {w.slug}</div>
                <div>Rolün: {ws.data.userRole}</div>
              </div>

              {canUpdate ? (
                <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
                  {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Bu workspace’i güncelleme yetkin yok.
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
