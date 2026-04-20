'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
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
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { metaApi } from '@/lib/api/meta';
import { useCan } from '@/lib/auth/use-can';

export function MetaConnectionClient(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const qc = useQueryClient();

  const canConnect = useCan('bisu:connect');
  const canRotate = useCan('bisu:rotate');
  const canDisconnect = useCan('bisu:disconnect');
  const canReadAdAccounts = useCan('adaccount:read');

  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const status = useQuery({
    queryKey: ['meta', slug, 'connection'],
    queryFn: () => metaApi.current(slug),
    staleTime: 30_000,
  });

  const init = useMutation({
    mutationFn: () => metaApi.initConnect(slug),
    onSuccess: ({ authorizeUrl }) => {
      // Hand the user off to Meta (or the mock provider, which redirects
      // straight back). Browser navigates away, so no further work here.
      window.location.assign(authorizeUrl);
    },
  });

  const rotate = useMutation({
    mutationFn: (connectionId: string) => metaApi.rotate(slug, connectionId),
    onSuccess: () => {
      toast.success('Token yenilendi');
      void qc.invalidateQueries({ queryKey: ['meta', slug, 'connection'] });
    },
  });

  const disconnect = useMutation({
    mutationFn: (connectionId: string) => metaApi.disconnect(slug, connectionId),
    onSuccess: () => {
      toast.success('Meta bağlantısı kaldırıldı');
      void qc.invalidateQueries({ queryKey: ['meta', slug, 'connection'] });
      void qc.invalidateQueries({ queryKey: ['meta', slug, 'ad-accounts'] });
      setDisconnectOpen(false);
    },
  });

  const sync = useMutation({
    mutationFn: (connectionId: string) => metaApi.syncAdAccounts(slug, connectionId),
    onSuccess: ({ adAccounts }) => {
      toast.success(`${adAccounts.length.toString()} hesap senkronize edildi`);
      void qc.invalidateQueries({ queryKey: ['meta', slug, 'ad-accounts'] });
    },
  });

  const adAccounts = useQuery({
    queryKey: ['meta', slug, 'ad-accounts', status.data?.connection?.id],
    queryFn: () => metaApi.listAdAccounts(slug, status.data?.connection?.id ?? ''),
    enabled: Boolean(status.data?.connection?.id) && canReadAdAccounts,
    staleTime: 60_000,
  });

  if (status.isPending) return <Skeleton className="h-48 w-full" />;
  if (status.isError) {
    const code = status.error instanceof ApiError ? status.error.body.code : 'unknown';
    return (
      <Alert variant="destructive">
        <AlertDescription>Bağlantı durumu yüklenemedi ({code}).</AlertDescription>
      </Alert>
    );
  }

  const initError = init.error instanceof ApiError ? init.error : null;

  if (!status.data.connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Henüz bağlı değil</CardTitle>
          <CardDescription>
            Meta Business hesabını bağlamak için aşağıdaki butona tıkla. Açılan izin sayfasında
            istenen yetkileri onayladıktan sonra otomatik olarak buraya geri döneceksin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initError ? (
            <Alert variant="destructive">
              <AlertDescription>{initError.body.message}</AlertDescription>
            </Alert>
          ) : null}
          {canConnect ? (
            <Button
              onClick={() => {
                init.mutate();
              }}
              disabled={init.isPending}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {init.isPending ? 'Yönlendiriliyor…' : "Meta'ya bağlan"}
            </Button>
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Bu workspace için Meta bağlantısı yapma yetkin yok.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const c = status.data.connection;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--success))]" />
              {c.displayName}
            </CardTitle>
            <CardDescription>Meta user id: {c.metaUserId}</CardDescription>
          </div>
          <Badge variant={c.status === 'ACTIVE' ? 'success' : 'destructive'}>{c.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Yetkiler</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {c.scopes.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Sona eriyor</dt>
              <dd className="mt-1">
                {c.expiresAt ? new Date(c.expiresAt).toLocaleString('tr-TR') : 'Süresiz'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Bağlanan tarih</dt>
              <dd className="mt-1">{new Date(c.createdAt).toLocaleString('tr-TR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Son yenileme</dt>
              <dd className="mt-1">
                {c.lastRotatedAt ? new Date(c.lastRotatedAt).toLocaleString('tr-TR') : '—'}
              </dd>
            </div>
          </dl>

          <div className="flex gap-2 pt-2">
            {canRotate ? (
              <Button
                variant="outline"
                size="sm"
                disabled={rotate.isPending}
                onClick={() => {
                  rotate.mutate(c.id);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {rotate.isPending ? 'Yenileniyor…' : "Token'ı yenile"}
              </Button>
            ) : null}
            {canDisconnect ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDisconnectOpen(true);
                }}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Bağlantıyı kaldır
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canReadAdAccounts ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Reklam hesapları</CardTitle>
              <CardDescription>
                {adAccounts.data
                  ? `${adAccounts.data.adAccounts.length.toString()} hesap görüntülenebiliyor.`
                  : 'Henüz senkronize edilmemiş.'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              onClick={() => {
                sync.mutate(c.id);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {sync.isPending ? 'Senkronize ediliyor…' : 'Senkronize et'}
            </Button>
          </CardHeader>
          <CardContent>
            {adAccounts.data && adAccounts.data.adAccounts.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="py-2">Hesap</th>
                    <th className="py-2">Para birimi</th>
                    <th className="py-2">Saat dilimi</th>
                    <th className="py-2">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adAccounts.data.adAccounts.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2">
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {a.metaAdAccountId}
                        </div>
                      </td>
                      <td className="py-2">{a.currency}</td>
                      <td className="py-2">{a.timezone ?? '—'}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{a.status ?? '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Henüz hiç hesap çekilmedi. “Senkronize et” ile listeyi getir.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bağlantıyı kaldır</DialogTitle>
            <DialogDescription>
              Bu workspace’in Meta erişimi sonlandırılır. Saklanan token derhal iptal edilir, reklam
              hesapları listesi temizlenir. İşlem geri alınamaz — yeniden bağlanmak için tüm akışı
              baştan yapman gerekir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisconnectOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => {
                disconnect.mutate(c.id);
              }}
            >
              {disconnect.isPending ? 'Kaldırılıyor…' : 'Bağlantıyı kaldır'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
