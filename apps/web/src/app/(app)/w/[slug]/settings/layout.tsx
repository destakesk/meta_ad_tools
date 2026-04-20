'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const ITEMS = [
  { suffix: '', label: 'Genel' },
  { suffix: '/meta', label: 'Meta bağlantısı' },
];

export default function WorkspaceSettingsLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const base = `/w/${params.slug}/settings`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 md:flex-row">
      <aside className="md:w-56">
        <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">
          Workspace ayarları
        </h2>
        <nav className="flex flex-col gap-1 text-sm">
          {ITEMS.map((item) => {
            const href = `${base}${item.suffix}`;
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
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
