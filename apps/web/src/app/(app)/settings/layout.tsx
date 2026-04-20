'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const NAV = [
  { href: '/settings/profile', label: 'Profil' },
  { href: '/settings/security', label: 'Güvenlik' },
  { href: '/settings/sessions', label: 'Oturumlar' },
  { href: '/settings/organization', label: 'Organizasyon' },
  { href: '/settings/members', label: 'Üyeler' },
];

// Workspace-scoped nav items live in the workspace layout, not here. Module
// 03 added Meta connection at /w/[slug]/settings/meta — surfaced from the
// workspace home + topbar instead of the org-level settings sidebar.

export default function SettingsLayout({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 md:flex-row">
      <aside className="md:w-56">
        <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Ayarlar</h2>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2',
                  active
                    ? 'bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
