'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { creativesApi } from '@/lib/api/creatives';
import { metaApi } from '@/lib/api/meta';
import { useCan } from '@/lib/auth/use-can';

interface CreateFormValues {
  adAccountId: string;
  name: string;
  kind: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'LINK' | 'POST';
  thumbUrl: string;
}

export function CreativesClient(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const qc = useQueryClient();
  const canWrite = useCan('creative:write');
  const canDelete = useCan('creative:delete');

  const [createOpen, setCreateOpen] = useState(false);

  const connection = useQuery({
    queryKey: ['meta-connection', slug],
    queryFn: () => metaApi.current(slug),
    staleTime: 60_000,
  });

  const adAccounts = useQuery({
    queryKey: ['meta-adaccounts', slug, connection.data?.connection?.id],
    queryFn: () => metaApi.listAdAccounts(slug, connection.data!.connection!.id),
    enabled: Boolean(connection.data?.connection?.id),
    staleTime: 60_000,
  });

  const list = useQuery({
    queryKey: ['creatives', slug],
    queryFn: () => creativesApi.listForWorkspace(slug),
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: (adAccountId: string) => creativesApi.syncForAdAccount(slug, adAccountId),
    onSuccess: ({ syncedCount }) => {
      toast.success(`${syncedCount.toString()} creative senkronize edildi`);
      void qc.invalidateQueries({ queryKey: ['creatives', slug] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => creativesApi.delete(slug, id),
    onSuccess: () => {
      toast.success('Creative silindi');
      void qc.invalidateQueries({ queryKey: ['creatives', slug] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.body.code === 'creative_in_use') {
        toast.error('Bu creative bir reklamda aktif olarak kullanılıyor.');
      }
    },
  });

  const form = useForm<CreateFormValues>({
    defaultValues: { adAccountId: '', name: '', kind: 'IMAGE', thumbUrl: '' },
  });

  const create = useMutation({
    mutationFn: (values: CreateFormValues) =>
      creativesApi.create(slug, {
        adAccountId: values.adAccountId,
        name: values.name,
        kind: values.kind,
        ...(values.thumbUrl.length > 0 ? { thumbUrl: values.thumbUrl } : {}),
      }),
    onSuccess: () => {
      toast.success('Creative oluşturuldu');
      void qc.invalidateQueries({ queryKey: ['creatives', slug] });
      setCreateOpen(false);
      form.reset();
    },
  });

  const createError = create.error instanceof ApiError ? create.error : null;
  const accounts = adAccounts.data?.adAccounts ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Creative kütüphanesi</CardTitle>
          <CardDescription>
            Meta’dan senkronize edilen görsel / video / link tasarımları. Reklam oluştururken
            bunlardan biri seçilir.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              onClick={() => {
                const first = accounts[0];
                if (first) sync.mutate(first.id);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {sync.isPending ? 'Senkronize…' : 'Senkronize et'}
            </Button>
          ) : null}
          {canWrite ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={accounts.length === 0}>
                  Yeni creative
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni creative</DialogTitle>
                  <DialogDescription>
                    Creative bir ad account altında oluşturulur. Object story spec opsiyoneldir.
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
                    {createError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{createError.body.message}</AlertDescription>
                      </Alert>
                    ) : null}
                    <FormField
                      control={form.control}
                      name="adAccountId"
                      rules={{ required: 'Ad account seç' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ad account</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            >
                              <option value="">— seç —</option>
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} · {a.currency}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: 'Ad gerekli' }}
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
                      name="kind"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tür</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            >
                              <option value="IMAGE">IMAGE</option>
                              <option value="VIDEO">VIDEO</option>
                              <option value="CAROUSEL">CAROUSEL</option>
                              <option value="LINK">LINK</option>
                              <option value="POST">POST</option>
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thumbUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Thumb URL (opsiyonel)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://..." />
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
                          setCreateOpen(false);
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
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : list.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Creative’ler yüklenemedi.</AlertDescription>
          </Alert>
        ) : list.data.creatives.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Henüz creative yok. “Senkronize et” veya “Yeni creative” ile başla.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.creatives.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {c.metaCreativeId}
                    </div>
                  </div>
                  <Badge>{c.kind}</Badge>
                </div>
                {c.thumbUrl !== null ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbUrl}
                    alt={c.name}
                    className="mt-2 h-24 w-full rounded bg-[hsl(var(--muted))] object-cover"
                  />
                ) : null}
                {canDelete ? (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={del.isPending}
                      onClick={() => {
                        del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
