'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AdSetsPanel } from '@/components/campaigns/adsets-panel';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { campaignsApi } from '@/lib/api/campaigns';
import { ApiError } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-can';
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
  const router = useRouter();
  const qc = useQueryClient();

  const canWrite = useCan('campaign:write');
  const canDelete = useCan('campaign:delete');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'PAUSED'>('PAUSED');

  const { from, to } = useMemo(() => lastNDaysRange(DAYS), []);

  const detail = useQuery({
    queryKey: ['campaign', slug, id],
    queryFn: () => campaignsApi.detail(slug, id),
    staleTime: 30_000,
  });

  const update = useMutation({
    mutationFn: (body: { name?: string; status?: 'ACTIVE' | 'PAUSED' }) =>
      campaignsApi.update(slug, id, body),
    onSuccess: () => {
      toast.success('Kampanya güncellendi');
      void qc.invalidateQueries({ queryKey: ['campaign', slug, id] });
      void qc.invalidateQueries({ queryKey: ['campaigns', slug] });
      setEditOpen(false);
    },
  });

  const del = useMutation({
    mutationFn: () => campaignsApi.delete(slug, id),
    onSuccess: () => {
      toast.success('Kampanya silindi');
      void qc.invalidateQueries({ queryKey: ['campaigns', slug] });
      router.push(`/w/${slug}/campaigns`);
    },
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
          <div className="flex items-center gap-2">
            <Badge>{c.status}</Badge>
            {canWrite ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditName(c.name);
                  setEditStatus(c.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED');
                  setEditOpen(true);
                }}
              >
                Düzenle
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Sil
              </Button>
            ) : null}
          </div>
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

      <AdSetsPanel slug={slug} campaignId={id} currency={c.currency} />

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

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) update.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kampanyayı düzenle</DialogTitle>
            <DialogDescription>
              Adı ve durumu güncelleyebilirsin. Bütçe değişiklikleri için ayrı bir akış Module 06’da
              gelecek.
            </DialogDescription>
          </DialogHeader>
          {update.error instanceof ApiError ? (
            <Alert variant="destructive">
              <AlertDescription>{update.error.body.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Ad</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-status">Durum</Label>
              <select
                id="edit-status"
                value={editStatus}
                onChange={(e) => {
                  setEditStatus(e.target.value as 'ACTIVE' | 'PAUSED');
                }}
                className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              disabled={update.isPending || editName.length === 0}
              onClick={() => {
                update.mutate({ name: editName, status: editStatus });
              }}
            >
              {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kampanyayı sil</DialogTitle>
            <DialogDescription>
              Bu işlem Meta tarafında kampanyanın statüsünü DELETED yapar ve local cache’te de
              DELETED olarak işaretler. Geri almak için Meta’dan manuel yeniden etkinleştirmen
              gerekir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                del.mutate();
              }}
            >
              {del.isPending ? 'Siliniyor…' : 'Evet, sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
