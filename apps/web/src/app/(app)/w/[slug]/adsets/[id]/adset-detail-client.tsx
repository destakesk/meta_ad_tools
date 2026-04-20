'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdsPanel } from '@/components/adsets/ads-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adSetsApi } from '@/lib/api/adsets';

export function AdSetDetailClient(): React.ReactElement {
  const params = useParams<{ slug: string; id: string }>();
  const { slug, id } = params;

  const detail = useQuery({
    queryKey: ['adset', slug, id],
    queryFn: () => adSetsApi.detail(slug, id),
    staleTime: 30_000,
  });

  if (detail.isPending) return <Skeleton className="h-40 w-full" />;
  if (detail.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Ad set yüklenemedi.</AlertDescription>
      </Alert>
    );
  }

  const adset = detail.data.adSet;

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/w/${slug}/campaigns/${adset.campaignId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kampanyaya dön
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{adset.name}</CardTitle>
              <CardDescription>{adset.metaAdSetId}</CardDescription>
            </div>
            <Badge variant={statusVariant(adset.status)}>{adset.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-[hsl(var(--muted-foreground))]">Optimizasyon</dt>
            <dd>{adset.optimizationGoal ?? '—'}</dd>
            <dt className="text-[hsl(var(--muted-foreground))]">Faturalama</dt>
            <dd>{adset.billingEvent ?? '—'}</dd>
            <dt className="text-[hsl(var(--muted-foreground))]">Günlük bütçe</dt>
            <dd>{adset.dailyBudgetCents ?? '—'}</dd>
            <dt className="text-[hsl(var(--muted-foreground))]">Toplam bütçe</dt>
            <dd>{adset.lifetimeBudgetCents ?? '—'}</dd>
          </dl>
        </CardContent>
      </Card>

      <AdsPanel slug={slug} adsetId={id} />
    </>
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
