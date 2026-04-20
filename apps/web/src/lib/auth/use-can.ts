'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import type { PermissionKey } from '@metaflow/shared-types';

import { api } from '@/lib/api/client';

interface EffectivePermissionsResponse {
  permissions: string[];
}

/**
 * Frontend permission check — fetches the effective permission set for the
 * current user + workspace from the API. The API is the authority; this hook
 * drives UI visibility only (e.g., hide a "New Campaign" button for VIEWER).
 *
 * Derives the workspace slug from the URL path (`/w/:slug/...`).
 * Org-scoped permissions work without a workspace slug.
 */
export function useCan(permission: PermissionKey): boolean {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug;

  // Lazy: only fetch when a consumer calls useCan somewhere in the tree.
  const { data } = useQuery<EffectivePermissionsResponse>({
    queryKey: ['permissions', slug ?? 'org'],
    queryFn: async () => {
      const q = slug ? `?workspaceSlug=${encodeURIComponent(slug)}` : '';
      try {
        return await api.get<EffectivePermissionsResponse>(`/api/users/me/permissions${q}`);
      } catch {
        return { permissions: [] };
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  return data?.permissions.includes(permission) ?? false;
}
