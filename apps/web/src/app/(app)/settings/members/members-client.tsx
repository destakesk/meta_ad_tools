'use client';

import { useQuery } from '@tanstack/react-query';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InviteMemberDialog } from '@/components/workspace/invite-member-dialog';
import { ApiError } from '@/lib/api/client';
import { orgsApi } from '@/lib/api/organizations';
import { useCan } from '@/lib/auth/use-can';

export function MembersClient(): React.ReactElement {
  const canInvite = useCan('member:invite');

  const org = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: () => orgsApi.current(),
    staleTime: 60_000,
  });

  const orgId = org.data?.organization.id;

  const members = useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => (orgId ? orgsApi.listMembers(orgId) : Promise.reject(new Error('no_org'))),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });

  if (org.isPending || (orgId && members.isPending)) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (org.error || members.error) {
    const code =
      members.error instanceof ApiError
        ? members.error.body.code
        : org.error instanceof ApiError
          ? org.error.body.code
          : 'unknown';
    return (
      <Alert variant="destructive">
        <AlertDescription>Üyeler yüklenemedi ({code}).</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {canInvite && orgId ? (
        <div className="flex justify-end">
          <InviteMemberDialog orgId={orgId} />
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Üye</th>
                <th className="px-4 py-3">Org rol</th>
                <th className="px-4 py-3">Workspace’ler</th>
                <th className="px-4 py-3">Katılım</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.data?.members.map((m) => (
                <tr key={m.userId}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.fullName}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={m.orgRole === 'OWNER' ? 'default' : 'secondary'}>
                      {m.orgRole}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {m.workspaces.length === 0 ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.workspaces.map((w) => (
                          <Badge key={w.workspaceId} variant="outline">
                            {w.name} · {w.role}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
