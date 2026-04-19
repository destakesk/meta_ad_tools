import { healthResponseSchema } from '@metaflow/shared-types';

import type { HealthResponse } from '@metaflow/shared-types';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] ?? process.env['API_URL'] ?? 'http://localhost:3001';

/**
 * Thin `fetch` wrapper. Keeps the network boundary in one file so tests can
 * stub it out without reaching into every consumer.
 *
 * `cache: 'no-store'` — live state, never cached by RSC fetch dedup.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${path} → ${response.status.toString()} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export interface TerminusHealthResponse {
  status: 'ok' | 'error' | 'shutting_down';
  info: Record<string, { status: string; state?: string }>;
  error: Record<string, { status: string; state?: string; error?: string }>;
  details: Record<string, { status: string; state?: string }>;
}

/**
 * Calls the Nest `/health/ready` endpoint (Terminus shape) and adapts it into
 * the shared `HealthResponse` contract consumed by the status page.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  let terminus: TerminusHealthResponse | undefined;
  try {
    terminus = await request<TerminusHealthResponse>('/health/ready');
  } catch {
    // Either the API is down, or it returned 503 (which Terminus still
    // includes in the response body). We'll fall through to a "down" state.
  }

  const services = {
    database: detectState(terminus, 'database'),
    redis: detectState(terminus, 'redis'),
  };

  const allUp = services.database === 'connected' && services.redis === 'connected';
  const anyUp = services.database === 'connected' || services.redis === 'connected';
  const status: HealthResponse['status'] = allUp ? 'ok' : anyUp ? 'degraded' : 'down';

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: 0,
    version: process.env['NEXT_PUBLIC_APP_VERSION'] ?? '0.1.0',
    services,
  };

  return healthResponseSchema.parse(response);
}

function detectState(
  result: TerminusHealthResponse | undefined,
  key: string,
): 'connected' | 'disconnected' {
  if (!result) return 'disconnected';
  const infoEntry = result.info[key];
  const errorEntry = result.error[key];
  if (infoEntry?.state === 'connected') return 'connected';
  if (errorEntry) return 'disconnected';
  const detailEntry = result.details[key];
  return detailEntry?.state === 'connected' ? 'connected' : 'disconnected';
}
