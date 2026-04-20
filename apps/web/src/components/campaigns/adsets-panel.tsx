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
import { adSetsApi } from '@/lib/api/adsets';
import { ApiError } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-can';
import { formatCents } from '@/lib/format';

interface Props {
  slug: string;
  campaignId: string;
  currency: string | null;
}

const OPTIMIZATION_GOALS = [
  'LINK_CLICKS',
  'IMPRESSIONS',
  'REACH',
  'OFFSITE_CONVERSIONS',
  'LANDING_PAGE_VIEWS',
  'POST_ENGAGEMENT',
] as const;

const BILLING_EVENTS = ['IMPRESSIONS', 'LINK_CLICKS'] as const;

interface CreateFormValues {
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  optimizationGoal: string;
  billingEvent: string;
  budgetKind: 'daily' | 'lifetime';
  budgetMajor: string;
}

export function AdSetsPanel({ slug, campaignId, currency }: Props): React.ReactElement {
  const qc = useQueryClient();
  const canWrite = useCan('adset:write');
  const canDelete = useCan('campaign:delete');

  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({
    queryKey: ['adsets', slug, campaignId],
    queryFn: () => adSetsApi.listForCampaign(slug, campaignId),
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: () => adSetsApi.sync(slug, campaignId),
    onSuccess: ({ syncedCount }) => {
      toast.success(`${syncedCount.toString()} ad set senkronize edildi`);
      void qc.invalidateQueries({ queryKey: ['adsets', slug, campaignId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => adSetsApi.delete(slug, id),
    onSuccess: () => {
      toast.success('Ad set silindi');
      void qc.invalidateQueries({ queryKey: ['adsets', slug, campaignId] });
    },
  });

  const form = useForm<CreateFormValues>({
    defaultValues: {
      name: '',
      status: 'PAUSED',
      optimizationGoal: 'LINK_CLICKS',
      billingEvent: 'IMPRESSIONS',
      budgetKind: 'daily',
      budgetMajor: '25',
    },
  });

  const create = useMutation({
    mutationFn: (values: CreateFormValues) => {
      const cents = Math.round(Number(values.budgetMajor) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        throw new Error('Pozitif bir bütçe gir');
      }
      return adSetsApi.create(slug, campaignId, {
        name: values.name,
        status: values.status,
        optimizationGoal: values.optimizationGoal,
        billingEvent: values.billingEvent,
        ...(values.budgetKind === 'daily'
          ? { dailyBudgetCents: cents.toString() }
          : { lifetimeBudgetCents: cents.toString() }),
      });
    },
    onSuccess: () => {
      toast.success('Ad set oluşturuldu');
      void qc.invalidateQueries({ queryKey: ['adsets', slug, campaignId] });
      setCreateOpen(false);
      form.reset();
    },
  });

  const createError = create.error instanceof ApiError ? create.error : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Ad Set’ler</CardTitle>
          <CardDescription>
            Kampanya altındaki hedefleme + bütçe grupları. Meta’dan senkronize edilir.
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
                <Button size="sm">Yeni ad set</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni ad set</DialogTitle>
                  <DialogDescription>
                    Bütçe major units olarak girilir; API’ye minor units olarak gider.
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

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="optimizationGoal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Optimizasyon hedefi</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                              >
                                {OPTIMIZATION_GOALS.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billingEvent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Faturalama</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                              >
                                {BILLING_EVENTS.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="budgetKind"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bütçe türü</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                              >
                                <option value="daily">Günlük</option>
                                <option value="lifetime">Toplam</option>
                              </select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="budgetMajor"
                        rules={{ required: 'Bütçe gerekli' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bütçe (major)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
            <AlertDescription>Ad set’ler yüklenemedi.</AlertDescription>
          </Alert>
        ) : list.data.adSets.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Henüz ad set yok. Yukarıdaki “Senkronize et” veya “Yeni ad set” ile başla.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="py-2">Ad</th>
                <th className="py-2">Durum</th>
                <th className="py-2">Hedef</th>
                <th className="py-2 text-right">Günlük</th>
                <th className="py-2 text-right">Toplam</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.adSets.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {s.metaAdSetId}
                    </div>
                  </td>
                  <td className="py-2">
                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                  </td>
                  <td className="py-2 text-xs">{s.optimizationGoal ?? '—'}</td>
                  <td className="py-2 text-right">{formatCents(s.dailyBudgetCents, currency)}</td>
                  <td className="py-2 text-right">
                    {formatCents(s.lifetimeBudgetCents, currency)}
                  </td>
                  <td className="py-2 text-right">
                    {canDelete && s.status !== 'DELETED' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={del.isPending}
                        onClick={() => {
                          del.mutate(s.id);
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
