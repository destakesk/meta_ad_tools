'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2 } from 'lucide-react';
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
import { adsApi } from '@/lib/api/ads';
import { ApiError } from '@/lib/api/client';
import { creativesApi } from '@/lib/api/creatives';
import { useCan } from '@/lib/auth/use-can';

interface Props {
  slug: string;
  adsetId: string;
}

interface CreateFormValues {
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  creativeId: string;
}

export function AdsPanel({ slug, adsetId }: Props): React.ReactElement {
  const qc = useQueryClient();
  const canWrite = useCan('ad:write');
  const canDelete = useCan('ad:delete');

  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({
    queryKey: ['ads', slug, adsetId],
    queryFn: () => adsApi.listForAdSet(slug, adsetId),
    staleTime: 30_000,
  });

  const creatives = useQuery({
    queryKey: ['creatives', slug],
    queryFn: () => creativesApi.listForWorkspace(slug),
    staleTime: 60_000,
    enabled: canWrite,
  });

  const sync = useMutation({
    mutationFn: () => adsApi.sync(slug, adsetId),
    onSuccess: ({ syncedCount }) => {
      toast.success(`${syncedCount.toString()} reklam senkronize edildi`);
      void qc.invalidateQueries({ queryKey: ['ads', slug, adsetId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => adsApi.delete(slug, id),
    onSuccess: () => {
      toast.success('Reklam silindi');
      void qc.invalidateQueries({ queryKey: ['ads', slug, adsetId] });
    },
  });

  const form = useForm<CreateFormValues>({
    defaultValues: { name: '', status: 'PAUSED', creativeId: '' },
  });

  const create = useMutation({
    mutationFn: (values: CreateFormValues) =>
      adsApi.create(slug, adsetId, {
        creativeId: values.creativeId,
        name: values.name,
        status: values.status,
      }),
    onSuccess: () => {
      toast.success('Reklam oluşturuldu');
      void qc.invalidateQueries({ queryKey: ['ads', slug, adsetId] });
      setCreateOpen(false);
      form.reset();
    },
  });

  const createError = create.error instanceof ApiError ? create.error : null;
  const availableCreatives = creatives.data?.creatives ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Reklamlar</CardTitle>
          <CardDescription>
            Ad set altındaki reklamlar. Her reklam bir creative’e bağlı.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={sync.isPending}
            onClick={() => {
              sync.mutate();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {sync.isPending ? 'Senkronize…' : 'Senkronize et'}
          </Button>
          {canWrite ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={availableCreatives.length === 0}>
                  Yeni reklam
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni reklam</DialogTitle>
                  <DialogDescription>
                    Reklam bir creative referansı ve başlangıç durumuyla yayına alınır.
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
                      name="creativeId"
                      rules={{ required: 'Creative seç' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Creative</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            >
                              <option value="">— seç —</option>
                              {availableCreatives.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} · {c.kind}
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
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Başlangıç durumu</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            >
                              <option value="PAUSED">PAUSED (güvenli)</option>
                              <option value="ACTIVE">ACTIVE</option>
                            </select>
                          </FormControl>
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
            <AlertDescription>Reklamlar yüklenemedi.</AlertDescription>
          </Alert>
        ) : list.data.ads.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Henüz reklam yok. “Senkronize et” veya “Yeni reklam” ile başla.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="py-2">Ad</th>
                <th className="py-2">Durum</th>
                <th className="py-2">Creative</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.ads.map((a) => (
                <tr key={a.id}>
                  <td className="py-2">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{a.metaAdId}</div>
                  </td>
                  <td className="py-2">
                    <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="py-2 text-xs">{a.creativeId ?? '—'}</td>
                  <td className="py-2 text-right">
                    {canDelete && a.status !== 'DELETED' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={del.isPending}
                        onClick={() => {
                          del.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function statusVariant(status: string): 'success' | 'warning' | 'secondary' | 'destructive' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PAUSED':
      return 'warning';
    case 'DELETED':
      return 'destructive';
    default:
      return 'secondary';
  }
}
