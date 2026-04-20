'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { orgsApi } from '@/lib/api/organizations';
import { useCurrentUser } from '@/lib/auth/use-auth';

export function DashboardClient(): React.ReactElement {
  const user = useCurrentUser();
  const { data, isPending, error } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: () => orgsApi.current(),
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    const code = error instanceof ApiError ? error.body.code : 'unknown';
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Organizasyon bilgisi yüklenemedi ({code}). Lütfen sayfayı yenileyin.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Hoş geldin{user?.fullName ? `, ${user.fullName.split(' ')[0] ?? ''}` : ''}
        </h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          {data.organization.name} • rol: {data.userRole}
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workspace’ler</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/organization">
              <Plus className="mr-2 h-4 w-4" /> Yeni workspace
            </Link>
          </Button>
        </div>

        {data.workspaces.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Bu organizasyonda henüz bir workspace yok. Sağ üstten oluşturabilirsin.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.workspaces.map((w) => (
              <Card key={w.id}>
                <CardHeader>
                  <CardTitle className="text-base">{w.name}</CardTitle>
                  <CardDescription>/{w.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="ghost" size="sm" className="-ml-3">
                    <Link href={`/w/${w.slug}`}>
                      Aç <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
