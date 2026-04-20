'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { orgsApi } from '@/lib/api/organizations';

/**
 * Lists the workspaces inside the current organization and lets the user
 * jump between them. Visible in the topbar of every signed-in route.
 */
export function WorkspaceSwitcher(): React.ReactElement {
  const params = useParams<{ slug?: string }>();
  const activeSlug = params.slug;

  const { data, isPending } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: () => orgsApi.current(),
    staleTime: 60_000,
  });

  if (isPending) return <Skeleton className="h-8 w-32" />;
  if (!data) return <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>;

  const active = data.workspaces.find((w) => w.slug === activeSlug);
  const label = active?.name ?? data.organization.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="max-w-[12rem] truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuLabel>{data.organization.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data.workspaces.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            Henüz workspace yok.
          </div>
        ) : (
          data.workspaces.map((w) => (
            <DropdownMenuItem key={w.id} asChild>
              <Link href={`/w/${w.slug}`} className="flex items-center justify-between gap-2">
                <span className="truncate">{w.name}</span>
                {w.slug === activeSlug ? <Check className="h-4 w-4" /> : null}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/organization" className="text-sm">
            <Plus className="mr-2 h-4 w-4" /> Yeni workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
