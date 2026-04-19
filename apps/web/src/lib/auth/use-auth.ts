'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/use-auth-store';

import type { LoginRequest, LoginResponse } from '@metaflow/shared-types';

/**
 * Mutation-based login that stashes the access token on success. MFA branches
 * (setup / challenge) return the required token; the UI routes the user to
 * the appropriate next step.
 */
export function useLogin() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: async (res: LoginResponse) => {
      if (res.step === 'success') {
        setAccessToken(res.accessToken);
        const me = await authApi.me();
        useAuthStore.getState().setMe(me);
        void qc.invalidateQueries();
      }
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clear();
      router.push('/login');
    },
  });
}

/**
 * Silent bootstrap — call once on app mount. If the refresh cookie is valid
 * we hydrate the store; otherwise we remain signed-out (no error).
 */
export function useAuthBootstrap(): { ready: boolean } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setMe = useAuthStore((s) => s.setMe);

  useEffect(() => {
    if (accessToken !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/api/auth/refresh`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Requested-With': 'metaflow-web' },
          },
        );
        if (!res.ok) return;
        const env = (await res.json()) as {
          success: true;
          data: { accessToken: string | null };
        };
        if (cancelled || !env.data.accessToken) return;
        setAccessToken(env.data.accessToken);
        const me = await authApi.me();
        if (!cancelled) setMe(me);
      } catch {
        // swallow — user is signed-out
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, setAccessToken, setMe]);

  return { ready: true };
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function useCurrentOrganizations() {
  return useAuthStore((s) => s.organizations);
}
