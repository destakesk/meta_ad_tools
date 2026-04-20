'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { campaignsApi } from '@/lib/api/campaigns';
import { formatCents, formatInteger, formatPercent } from '@/lib/format';

const DAYS = 14;

function lastNDaysRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function CampaignDetailClient(): React.ReactElement {
  const params = useParams<{ slug: string; id: string }>();
  const slug = params.slug;
  const id = params.id;

  const { from, to } = useMemo(() => lastNDaysRange(DAYS), []);

  const detail = useQuery({
    queryKey: ['campaign', slug, id],
    queryFn: () => campaignsApi.detail(slug, id),
    staleTime: 30_000,
  });

  const insights = useQuery({
    queryKey: ['campaign-insights', slug, id, from, to],
    queryFn: () => campaignsApi.campaignInsights(slug, id, from, to),
    staleTime: 60_000,
  });

  if (detail.isPending) return <Skeleton className="h-64 w-full" />;
  if (detail.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Kampanya yüklenemedi.</AlertDescription>
      </Alert>
    );
  }

  const c = detail.data.campaign;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={`/w/${slug}/campaigns`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Tüm kampanyalar
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{c.name}</CardTitle>
            <CardDescription>
              {c.metaAdAccountId} · {c.metaCampaignId}
            </CardDescription>
          </div>
          <Badge>{c.status}</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Amaç</dt>
              <dd className="mt-1">{c.objective ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Günlük bütçe</dt>
              <dd className="mt-1">{formatCents(c.dailyBudgetCents, c.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Toplam bütçe</dt>
              <dd className="mt-1">{formatCents(c.lifetimeBudgetCents, c.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Para birimi</dt>
              <dd className="mt-1">{c.currency ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Başlangıç</dt>
              <dd className="mt-1">
                {c.startTime ? new Date(c.startTime).toLocaleString('tr-TR') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Bitiş</dt>
              <dd className="mt-1">
                {c.endTime ? new Date(c.endTime).toLocaleString('tr-TR') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Son sync</dt>
              <dd className="mt-1">{new Date(c.syncedAt).toLocaleString('tr-TR')}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son {DAYS} gün</CardTitle>
          <CardDescription>
            {from} → {to} aralığındaki günlük performans (cache’ten). Daha geniş aralık için
            İçgörüler sayfasına geç.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : insights.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Insights yüklenemedi. Önce workspace insights sync’i yap.
              </AlertDescription>
            </Alert>
          ) : insights.data.rows.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Bu aralık için cache’de veri yok. /{slug}/insights sayfasından senkronize et.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Gösterim" value={formatInteger(insights.data.totals.impressions)} />
                <Metric label="Tıklama" value={formatInteger(insights.data.totals.clicks)} />
                <Metric
                  label="Harcama"
                  value={formatCents(insights.data.totals.spendCents, c.currency)}
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
                    <tr key={`${r.campaignId}-${r.date}`}>
                      <td className="py-2">{r.date}</td>
                      <td className="py-2 text-right">{formatInteger(r.impressions)}</td>
                      <td className="py-2 text-right">{formatInteger(r.clicks)}</td>
                      <td className="py-2 text-right">{formatPercent(r.ctr)}</td>
                      <td className="py-2 text-right">{formatCents(r.spendCents, c.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
