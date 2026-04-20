'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { workspacesApi } from '@/lib/api/workspaces';

export default function WorkspaceLayout({ children }: { children: ReactNode }): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // Validates membership client-side; the API also enforces it via
  // WorkspaceAccessGuard. This call surfaces 403 as an inline message.
  const ws = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 30_000,
  });

  if (ws.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (ws.isError) {
    const code = ws.error instanceof ApiError ? ws.error.body.code : 'unknown';
    const status = ws.error instanceof ApiError ? ws.error.status : 0;
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Alert variant="destructive">
          <AlertDescription>
            {status === 403
              ? 'Bu workspace’e erişim yetkin yok.'
              : status === 404
                ? 'Workspace bulunamadı.'
                : `Workspace yüklenemedi (${code}).`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
