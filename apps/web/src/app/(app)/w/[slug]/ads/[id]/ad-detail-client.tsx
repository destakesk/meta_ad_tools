'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { InsightsCard } from '@/components/insights/insights-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adsApi } from '@/lib/api/ads';

export function AdDetailClient(): React.ReactElement {
  const params = useParams<{ slug: string; id: string }>();
  const { slug, id } = params;

  const detail = useQuery({
    queryKey: ['ad', slug, id],
    queryFn: () => adsApi.detail(slug, id),
    staleTime: 30_000,
  });

  if (detail.isPending) return <Skeleton className="h-40 w-full" />;
  if (detail.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Reklam yüklenemedi.</AlertDescription>
      </Alert>
    );
  }

  const ad = detail.data.ad;

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/w/${slug}/adsets/${ad.adsetId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ad set’e dön
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{ad.name}</CardTitle>
              <CardDescription>{ad.metaAdId}</CardDescription>
            </div>
            <Badge variant={statusVariant(ad.status)}>{ad.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-[hsl(var(--muted-foreground))]">Effective status</dt>
            <dd>{ad.effectiveStatus ?? '—'}</dd>
            <dt className="text-[hsl(var(--muted-foreground))]">Creative</dt>
            <dd>{ad.creativeId ?? '—'}</dd>
            <dt className="text-[hsl(var(--muted-foreground))]">Son sync</dt>
            <dd>{new Date(ad.syncedAt).toLocaleString('tr-TR')}</dd>
          </dl>
        </CardContent>
      </Card>

      <InsightsCard
        queryKey={['ad-insights', slug, id]}
        currency={null}
        fetcher={(from, to) => adsApi.insights(slug, id, from, to)}
        syncer={(from, to) => adsApi.syncInsights(slug, id, { from, to })}
      />
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
