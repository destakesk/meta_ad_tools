'use client';

import { Topbar } from './topbar';

import type { ReactNode } from 'react';

import { useAuthBootstrap } from '@/lib/auth/use-auth';

/**
 * Wraps every signed-in route. Bootstraps the access token from the refresh
 * cookie (silent), renders the persistent topbar, and slots the page content
 * underneath. The middleware has already enforced cookie presence; here we
 * just hydrate the in-memory store.
 */
export function AppShell({ children }: { children: ReactNode }): React.ReactElement {
  useAuthBootstrap();

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
