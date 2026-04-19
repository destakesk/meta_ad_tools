import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchHealth } from '@/lib/api-client';
import type { HealthResponse, ServiceStatus } from '@metaflow/shared-types';

import { StatusRefresher } from './_components/status-refresher';

export const dynamic = 'force-dynamic';

/**
 * System status page — module 01 placeholder. In module 02 this route will be
 * replaced by the auth landing and the status view will move to /status.
 */
export default async function StatusPage(): Promise<ReactElement> {
  let initial: HealthResponse;
  try {
    initial = await fetchHealth();
  } catch {
    initial = {
      status: 'down',
      timestamp: new Date().toISOString(),
      uptime: 0,
      version: '0.1.0',
      services: { database: 'disconnected', redis: 'disconnected' },
    };
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">metaflow</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          module 01 bootstrap — system status
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System status</CardTitle>
              <CardDescription>
                Rolled up from the API <code className="font-mono">/health/ready</code> endpoint
              </CardDescription>
            </div>
            <OverallStatusBadge status={initial.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ServiceRow label="PostgreSQL" state={initial.services.database} />
          <ServiceRow label="Redis" state={initial.services.redis} />
          <div className="pt-2">
            <StatusRefresher initialData={initial} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function OverallStatusBadge({ status }: { status: HealthResponse['status'] }): ReactElement {
  const variant = status === 'ok' ? 'success' : status === 'degraded' ? 'warning' : 'destructive';
  return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
}

function ServiceRow({ label, state }: { label: string; state: ServiceStatus }): ReactElement {
  const variant = state === 'connected' ? 'success' : 'destructive';
  return (
    <div className="flex items-center justify-between rounded-md border px-4 py-3">
      <span className="font-medium">{label}</span>
      <Badge variant={variant}>{state}</Badge>
    </div>
  );
}
