'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCents, formatInteger, formatPercent } from '@/lib/format';

const DAYS = 14;

interface InsightRow {
  date: string;
  impressions: string;
  clicks: string;
  spendCents: string;
  conversions: string;
  ctr: number | null;
}

interface Totals {
  impressions: string;
  clicks: string;
  spendCents: string;
  conversions: string;
}

interface Props {
  queryKey: readonly unknown[];
  title?: string;
  description?: string;
  currency: string | null;
  fetcher: (from: string, to: string) => Promise<{ rows: InsightRow[]; totals: Totals }>;
  syncer: (from: string, to: string) => Promise<{ syncedCount: number }>;
}

/**
 * Generic cache-aware insights panel. Parent passes a fetcher +
 * syncer — the component doesn't care whether the scope is campaign /
 * adset / ad. Sync writes to the cache server-side, then re-fetches.
 */
export function InsightsCard({
  queryKey,
  title = `Son ${DAYS.toString()} gün`,
  description,
  currency,
  fetcher,
  syncer,
}: Props): React.ReactElement {
  const qc = useQueryClient();
  const { from, to } = useMemo(() => lastNDaysRange(DAYS), []);

  const insights = useQuery({
    queryKey: [...queryKey, from, to],
    queryFn: () => fetcher(from, to),
    staleTime: 60_000,
  });

  const sync = useMutation({
    mutationFn: () => syncer(from, to),
    onSuccess: ({ syncedCount }) => {
      toast.success(`${syncedCount.toString()} satır senkronize edildi`);
      void qc.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error('Insights senkronizasyonu başarısız');
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description ?? `${from} → ${to} aralığındaki günlük performans (cache’ten).`}
          </CardDescription>
        </div>
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
      </CardHeader>
      <CardContent>
        {insights.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : insights.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Insights yüklenemedi.</AlertDescription>
          </Alert>
        ) : insights.data.rows.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Bu aralık için cache’de veri yok. “Senkronize et” ile çek.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Gösterim" value={formatInteger(insights.data.totals.impressions)} />
              <Metric label="Tıklama" value={formatInteger(insights.data.totals.clicks)} />
              <Metric
                label="Harcama"
                value={formatCents(insights.data.totals.spendCents, currency)}
              />
              <Metric label="Dönüşüm" value={formatInteger(insights.data.totals.conversions)} />
            </div>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="py-2">Tarih</th>
                  <th className="py-2 text-right">Gösterim</th>
                  <th className="py-2 text-right">Tıklama</th>
                  <th className="py-2 text-right">CTR</th>
                  <th className="py-2 text-right">Harcama</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {insights.data.rows.map((r) => (
                  <tr key={r.date}>
                    <td className="py-2">{r.date}</td>
                    <td className="py-2 text-right">{formatInteger(r.impressions)}</td>
                    <td className="py-2 text-right">{formatInteger(r.clicks)}</td>
                    <td className="py-2 text-right">{formatPercent(r.ctr)}</td>
                    <td className="py-2 text-right">{formatCents(r.spendCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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

function lastNDaysRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
