'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { campaignsApi } from '@/lib/api/campaigns';
import { ApiError } from '@/lib/api/client';
import { metaApi } from '@/lib/api/meta';
import { formatCents } from '@/lib/format';

export function CampaignsClient(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const qc = useQueryClient();

  const metaStatus = useQuery({
    queryKey: ['meta', slug, 'connection'],
    queryFn: () => metaApi.current(slug),
    staleTime: 30_000,
  });

  const campaigns = useQuery({
    queryKey: ['campaigns', slug],
    queryFn: () => campaignsApi.list(slug),
    staleTime: 30_000,
    enabled: Boolean(metaStatus.data?.connection),
  });

  const sync = useMutation({
    mutationFn: () => campaignsApi.sync(slug),
    onSuccess: ({ syncedCount }) => {
      toast.success(`${syncedCount.toString()} kampanya senkronize edildi`);
      void qc.invalidateQueries({ queryKey: ['campaigns', slug] });
    },
  });

  if (metaStatus.isPending) return <Skeleton className="h-48 w-full" />;

  if (metaStatus.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Meta bağlantı durumu yüklenemedi.</AlertDescription>
      </Alert>
    );
  }

  if (!metaStatus.data.connection) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <Link2 className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm">
            Önce bu workspace’i bir Meta Business hesabına bağlaman gerekiyor.
          </p>
          <Button asChild size="sm">
            <Link href={`/w/${slug}/settings/meta`}>Meta bağlantısına git</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncError = sync.error instanceof ApiError ? sync.error : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={sync.isPending}
          onClick={() => {
            sync.mutate();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {sync.isPending ? 'Senkronize ediliyor…' : 'Meta’dan senkronize et'}
        </Button>
      </div>

      {syncError ? (
        <Alert variant="destructive">
          <AlertTitle>Senkronizasyon başarısız</AlertTitle>
          <AlertDescription>{syncError.body.message}</AlertDescription>
        </Alert>
      ) : null}

      {campaigns.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : campaigns.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Kampanya listesi yüklenemedi.</AlertDescription>
        </Alert>
      ) : campaigns.data.campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Hiç kampanya yok. Yukarıdaki “Senkronize et” butonu ile çekmeyi dene.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3">Kampanya</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Amaç</th>
                  <th className="px-4 py-3 text-right">Günlük bütçe</th>
                  <th className="px-4 py-3 text-right">Toplam bütçe</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.data.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {c.metaAdAccountId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{c.objective ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {formatCents(c.dailyBudgetCents, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCents(c.lifetimeBudgetCents, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/w/${slug}/campaigns/${c.id}`}>Detay →</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
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
