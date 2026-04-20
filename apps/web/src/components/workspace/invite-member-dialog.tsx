'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMemberRequestSchema } from '@metaflow/shared-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { InviteMemberRequest, InviteRole } from '@metaflow/shared-types';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { orgsApi } from '@/lib/api/organizations';

const ROLES: { value: InviteRole; label: string; description: string }[] = [
  {
    value: 'ORG_ADMIN',
    label: 'Org Admin',
    description: 'Organizasyonu yönetebilir, tüm workspace’lere erişir',
  },
  {
    value: 'ORG_MEMBER',
    label: 'Org Member',
    description: 'Organizasyona katılır, workspace erişimi davete bağlı',
  },
  { value: 'WS_ADMIN', label: 'Workspace Admin', description: 'Belirli bir workspace’i yönetir' },
  {
    value: 'WS_MANAGER',
    label: 'Workspace Manager',
    description: 'Kampanya/yaratıcı düzenleyebilir',
  },
  { value: 'WS_VIEWER', label: 'Workspace Viewer', description: 'Sadece okuma' },
];

interface Props {
  orgId: string;
  trigger?: React.ReactNode;
}

export function InviteMemberDialog({ orgId, trigger }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const form = useForm<InviteMemberRequest>({
    resolver: zodResolver(inviteMemberRequestSchema),
    defaultValues: { email: '', role: 'ORG_MEMBER' },
  });

  const mutation = useMutation({
    mutationFn: (body: InviteMemberRequest) => orgsApi.invite(orgId, body),
    onSuccess: () => {
      toast.success('Davet gönderildi');
      void qc.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
      form.reset({ email: '', role: 'ORG_MEMBER' });
      setOpen(false);
    },
  });

  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button>Üye davet et</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Üye davet et</DialogTitle>
          <DialogDescription>
            Davet bağlantısı 7 gün geçerli. Yeni kullanıcılar kayıt olduktan sonra otomatik
            organizasyona katılır.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit((values) => {
                mutation.mutate(values);
              })(e);
            }}
            className="space-y-4"
            noValidate
          >
            {apiError ? (
              <Alert variant="destructive">
                <AlertDescription>{apiError.body.message}</AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    {ROLES.find((r) => r.value === form.watch('role'))?.description}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                İptal
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Gönderiliyor…' : 'Davet gönder'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
