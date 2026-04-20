'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { HealthResponse } from '@metaflow/shared-types';

import { fetchHealth } from '@/lib/api-client';

interface Props {
  initialData: HealthResponse;
}

/**
 * Polls the API every 30s. When the status changes, calls `router.refresh()`
 * to re-run the server component so the page reflects the new state.
 */
export function StatusRefresher({ initialData }: Props): React.ReactElement {
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    initialData,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (data.status !== initialData.status) {
      router.refresh();
    }
  }, [data.status, initialData.status, router]);

  return (
    <span className="text-xs text-[hsl(var(--muted-foreground))]">
      auto-refresh: 30s · last: {new Date(data.timestamp).toLocaleTimeString()}
    </span>
  );
}
