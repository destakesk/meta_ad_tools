'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { campaignsApi, insightsApi } from '@/lib/api/campaigns';
import { ApiError } from '@/lib/api/client';
import { formatCents, formatInteger, formatPercent } from '@/lib/format';

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function InsightsClient(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const qc = useQueryClient();

  const [from, setFrom] = useState(() => daysAgo(13));
  const [to, setTo] = useState(() => daysAgo(0));

  const campaigns = useQuery({
    queryKey: ['campaigns', slug],
    queryFn: () => campaignsApi.list(slug),
    staleTime: 60_000,
  });

  const insights = useQuery({
    queryKey: ['insights', slug, from, to],
    queryFn: () => insightsApi.list(slug, from, to),
    staleTime: 60_000,
  });

  const sync = useMutation({
    mutationFn: () => insightsApi.sync(slug, { from, to }),
    onSuccess: ({ syncedCount }) => {
      toast.success(`${syncedCount.toString()} satır senkronize edildi`);
      void qc.invalidateQueries({ queryKey: ['insights', slug] });
    },
  });

  const campaignsById = useMemo(() => {
    const map = new Map<string, { name: string; currency: string | null }>();
    for (const c of campaigns.data?.campaigns ?? []) {
      map.set(c.id, { name: c.name, currency: c.currency });
    }
    return map;
  }, [campaigns.data]);

  const primaryCurrency = campaigns.data?.campaigns[0]?.currency ?? null;
  const syncError = sync.error instanceof ApiError ? sync.error : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tarih aralığı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="from">Başlangıç</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">Bitiş</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
              }}
            />
          </div>
          <Button
            onClick={() => {
              sync.mutate();
            }}
            disabled={sync.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {sync.isPending ? 'Senkronize ediliyor…' : 'Meta’dan senkronize et'}
          </Button>
        </CardContent>
      </Card>

      {syncError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {syncError.body.code === 'meta_connection_not_found'
              ? 'Önce workspace’i bir Meta hesabına bağlaman lazım.'
              : syncError.body.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {insights.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : insights.isError ? (
        <Alert variant="destructive">
          <AlertDescription>İçgörüler yüklenemedi.</AlertDescription>
        </Alert>
      ) : insights.data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Bu aralık için cache’de veri yok. “Meta’dan senkronize et” ile çekmeyi dene.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Gösterim" value={formatInteger(insights.data.totals.impressions)} />
            <Metric label="Tıklama" value={formatInteger(insights.data.totals.clicks)} />
            <Metric
              label="Harcama"
              value={formatCents(insights.data.totals.spendCents, primaryCurrency)}
            />
            <Metric label="Dönüşüm" value={formatInteger(insights.data.totals.conversions)} />
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-4 py-2">Tarih</th>
                    <th className="px-4 py-2">Kampanya</th>
                    <th className="px-4 py-2 text-right">Gösterim</th>
                    <th className="px-4 py-2 text-right">Tıklama</th>
                    <th className="px-4 py-2 text-right">CTR</th>
                    <th className="px-4 py-2 text-right">Harcama</th>
                    <th className="px-4 py-2 text-right">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {insights.data.rows.map((r) => {
                    const c = campaignsById.get(r.campaignId);
                    return (
                      <tr key={`${r.campaignId}-${r.date}`}>
                        <td className="px-4 py-2">{r.date}</td>
                        <td className="px-4 py-2">{c?.name ?? r.campaignId}</td>
                        <td className="px-4 py-2 text-right">{formatInteger(r.impressions)}</td>
                        <td className="px-4 py-2 text-right">{formatInteger(r.clicks)}</td>
                        <td className="px-4 py-2 text-right">{formatPercent(r.ctr)}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCents(r.spendCents, c?.currency ?? null)}
                        </td>
                        <td className="px-4 py-2 text-right">{formatInteger(r.conversions)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
