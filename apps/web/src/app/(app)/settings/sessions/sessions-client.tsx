'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export function SessionsClient(): React.ReactElement {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authApi.listSessions(),
    staleTime: 10_000,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success('Oturum sonlandırıldı');
        void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      } else if (res.error) {
        toast.error(res.error.message);
      }
    },
  });

  const logoutAll = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: ({ revokedCount }) => {
      toast.success(`Diğer ${revokedCount} oturum sonlandırıldı`);
      void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    const code = error instanceof ApiError ? error.body.code : 'unknown';
    return (
      <Alert variant="destructive">
        <AlertDescription>Oturumlar yüklenemedi ({code}).</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          disabled={logoutAll.isPending || data.sessions.length <= 1}
          onClick={() => {
            logoutAll.mutate();
          }}
        >
          {logoutAll.isPending ? 'İşleniyor…' : 'Diğer tüm oturumları sonlandır'}
        </Button>
      </div>

      <div className="space-y-2">
        {data.sessions.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-start gap-3">
                <Monitor className="mt-0.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.device ?? deriveDevice(s.userAgent)}</span>
                    {s.isCurrent ? <Badge variant="success">Bu cihaz</Badge> : null}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.ipAddress ?? 'IP yok'} · son etkileşim:{' '}
                    {new Date(s.lastUsedAt).toLocaleString('tr-TR')}
                  </div>
                  {s.userAgent ? (
                    <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {s.userAgent}
                    </div>
                  ) : null}
                </div>
              </div>
              {s.isCurrent ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => {
                    revoke.mutate(s.id);
                  }}
                >
                  Sonlandır
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function deriveDevice(ua: string | null): string {
  if (!ua) return 'Bilinmeyen cihaz';
  if (/mobile/i.test(ua)) return 'Mobil';
  if (/mac/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Tarayıcı';
}
