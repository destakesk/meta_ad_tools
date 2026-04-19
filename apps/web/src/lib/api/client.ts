import { useAuthStore } from '@/stores/use-auth-store';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorShape,
  ) {
    super(body.message);
  }
}

let refreshInflight: Promise<string | null> | null = null;

/**
 * Returns a fresh access token. If another refresh is already in-flight,
 * waits for it instead of triggering a second roundtrip (refresh storm
 * prevention).
 */
async function singleFlightRefresh(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'metaflow-web' },
      });
      if (!res.ok) return null;
      const envelope = (await res.json()) as {
        success: true;
        data: { accessToken: string | null };
      };
      const token = envelope.data.accessToken;
      useAuthStore.getState().setAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipRefresh?: boolean;
}

/**
 * Typed fetch wrapper:
 *   - Attaches `X-Requested-With: metaflow-web` (CSRF defence)
 *   - Attaches Bearer from in-memory Zustand store
 *   - On 401 once, runs silent refresh + retries the original request
 *   - Throws ApiError with the server's `{code,message,details}` envelope
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = opts;
  const buildHeaders = (): HeadersInit => {
    const token = useAuthStore.getState().accessToken;
    return {
      'Content-Type': 'application/json',
      'X-Requested-With': 'metaflow-web',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };
  };

  const doFetch = async (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: 'include',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await doFetch();

  if (response.status === 401 && !skipRefresh && path !== '/api/auth/refresh') {
    const newToken = await singleFlightRefresh();
    if (newToken) {
      response = await doFetch();
    } else {
      useAuthStore.getState().clear();
    }
  }

  if (!response.ok) {
    let body: ApiErrorShape;
    try {
      const envelope = (await response.json()) as { success: false; error: ApiErrorShape };
      body = envelope.error;
    } catch {
      body = { code: 'network_error', message: response.statusText };
    }
    throw new ApiError(response.status, body);
  }

  const envelope = (await response.json()) as { success: true; data: T };
  return envelope.data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
