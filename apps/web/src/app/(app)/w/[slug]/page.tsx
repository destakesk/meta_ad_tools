'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { workspacesApi } from '@/lib/api/workspaces';

export default function WorkspaceHome(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const ws = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
    staleTime: 30_000,
  });

  if (ws.isPending || !ws.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-6 py-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const w = ws.data.workspace;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{w.name}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            /{w.slug} • rol: {ws.data.userRole}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/w/${w.slug}/settings`}>Ayarlar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hızlı erişim</CardTitle>
          <CardDescription>Workspace içindeki ana ekranlar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/w/${w.slug}/campaigns`}>Kampanyalar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/w/${w.slug}/creatives`}>Creative kütüphanesi</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/w/${w.slug}/insights`}>İçgörüler</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/members">Ekip üyeleri</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
