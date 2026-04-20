'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createWorkspaceRequestSchema,
  updateOrganizationRequestSchema,
} from '@metaflow/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { CreateWorkspaceRequest, UpdateOrganizationRequest } from '@metaflow/shared-types';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { orgsApi } from '@/lib/api/organizations';
import { useCan } from '@/lib/auth/use-can';

export function OrganizationClient(): React.ReactElement {
  const qc = useQueryClient();
  const canUpdate = useCan('org:update');
  const canCreateWs = useCan('workspace:create');

  const { data, isPending, error } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: () => orgsApi.current(),
    staleTime: 60_000,
  });

  const renameForm = useForm<UpdateOrganizationRequest>({
    resolver: zodResolver(updateOrganizationRequestSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (data) renameForm.reset({ name: data.organization.name });
  }, [data, renameForm]);

  const rename = useMutation({
    mutationFn: (body: UpdateOrganizationRequest) =>
      data ? orgsApi.update(data.organization.id, body) : Promise.reject(new Error('no_org')),
    onSuccess: () => {
      toast.success('Organizasyon güncellendi');
      void qc.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
  });

  const renameError = rename.error instanceof ApiError ? rename.error : null;

  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (error) {
    const code = error instanceof ApiError ? error.body.code : 'unknown';
    return (
      <Alert variant="destructive">
        <AlertDescription>Organizasyon yüklenemedi ({code}).</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Genel</CardTitle>
          <CardDescription>
            Slug değiştirilemez. Yalnızca görünen ad güncellenebilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...renameForm}>
            <form
              onSubmit={(e) => {
                void renameForm.handleSubmit((values) => {
                  rename.mutate(values);
                })(e);
              }}
              className="space-y-4"
              noValidate
            >
              {renameError ? (
                <Alert variant="destructive">
                  <AlertDescription>{renameError.body.message}</AlertDescription>
                </Alert>
              ) : null}

              <FormField
                control={renameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organizasyon adı</FormLabel>
                    <FormControl>
                      <Input disabled={!canUpdate} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                <div>Slug: {data.organization.slug}</div>
                <div>Rolün: {data.userRole}</div>
              </div>

              {canUpdate ? (
                <Button type="submit" disabled={rename.isPending || !renameForm.formState.isDirty}>
                  {rename.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Organizasyonu güncelleme yetkin yok.
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Workspace’ler</CardTitle>
            <CardDescription>{data.workspaces.length} adet</CardDescription>
          </div>
          {canCreateWs ? <CreateWorkspaceDialog orgId={data.organization.id} /> : null}
        </CardHeader>
        <CardContent>
          {data.workspaces.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Henüz workspace yok.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.workspaces.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">/{w.slug}</div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/w/${w.slug}/settings`}>Ayarlar</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateWorkspaceDialog({ orgId }: { orgId: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const form = useForm<CreateWorkspaceRequest>({
    resolver: zodResolver(createWorkspaceRequestSchema),
    defaultValues: { name: '', slug: '' },
  });

  const create = useMutation({
    mutationFn: (body: CreateWorkspaceRequest) => orgsApi.createWorkspace(orgId, body),
    onSuccess: () => {
      toast.success('Workspace oluşturuldu');
      void qc.invalidateQueries({ queryKey: ['organizations', 'current'] });
      form.reset({ name: '', slug: '' });
      setOpen(false);
    },
  });

  const apiError = create.error instanceof ApiError ? create.error : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Yeni workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni workspace</DialogTitle>
          <DialogDescription>
            Slug, URL’de kullanılacak. Küçük harf, rakam ve tire kullanılabilir.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit((values) => {
                create.mutate(values);
              })(e);
            }}
            className="space-y-4"
            noValidate
          >
            {apiError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {apiError.body.code === 'slug_already_taken'
                    ? 'Bu slug zaten kullanılıyor.'
                    : apiError.body.code === 'reserved_slug'
                      ? 'Bu slug rezerve edilmiş.'
                      : apiError.body.message}
                </AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e.target.value.toLowerCase());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                İptal
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
