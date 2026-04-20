'use client';

import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher';
import { useCurrentUser, useLogout } from '@/lib/auth/use-auth';

export function Topbar(): React.ReactElement {
  const user = useCurrentUser();
  const logout = useLogout();
  const params = useParams<{ slug?: string }>();
  const inWorkspace = Boolean(params.slug);

  return (
    <header className="border-b bg-[hsl(var(--background))]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            metaflow
          </Link>
          <span className="hidden text-[hsl(var(--muted-foreground))] sm:inline">/</span>
          <WorkspaceSwitcher />
        </div>

        <nav className="flex items-center gap-1 text-sm">
          {inWorkspace ? (
            <>
              <Link
                href={`/w/${params.slug ?? ''}`}
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--accent))]"
              >
                Workspace
              </Link>
              <Link
                href={`/w/${params.slug ?? ''}/campaigns`}
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--accent))]"
              >
                Kampanyalar
              </Link>
              <Link
                href={`/w/${params.slug ?? ''}/insights`}
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--accent))]"
              >
                İçgörüler
              </Link>
            </>
          ) : null}
          <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--accent))]">
            Ana ekran
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Hesap menüsü">
                <UserIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-medium">{user?.fullName ?? '—'}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {user?.email ?? ''}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <Settings className="mr-2 h-4 w-4" /> Hesap ayarları
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout.mutate();
                }}
                className="text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))]"
              >
                <LogOut className="mr-2 h-4 w-4" /> Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
