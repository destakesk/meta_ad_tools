'use client';

import { createCampaignRequestSchema } from '@metaflow/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { CreateCampaignRequest } from '@metaflow/shared-types';

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { campaignsApi } from '@/lib/api/campaigns';
import { ApiError } from '@/lib/api/client';
import { metaApi } from '@/lib/api/meta';

interface Props {
  slug: string;
  trigger?: React.ReactNode;
}

interface FormValues {
  adAccountId: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED';
  budgetKind: 'daily' | 'lifetime';
  budgetMajor: string; // user-friendly major units; converted to cents on submit
}

const OBJECTIVES = [
  'OUTCOME_SALES',
  'OUTCOME_LEADS',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_TRAFFIC',
  'OUTCOME_AWARENESS',
  'OUTCOME_APP_PROMOTION',
] as const;

export function CreateCampaignDialog({ slug, trigger }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    defaultValues: {
      adAccountId: '',
      name: '',
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      budgetKind: 'daily',
      budgetMajor: '50',
    },
  });

  // Ad account list comes from the active Meta connection — we need the
  // meta status to know which connection id, then the cached ad-accounts.
  const meta = useQuery({
    queryKey: ['meta', slug, 'connection'],
    queryFn: () => metaApi.current(slug),
    staleTime: 60_000,
  });

  const adAccounts = useQuery({
    queryKey: ['meta', slug, 'ad-accounts', meta.data?.connection?.id],
    queryFn: () =>
      meta.data?.connection
        ? metaApi.listAdAccounts(slug, meta.data.connection.id)
        : Promise.resolve({ adAccounts: [] }),
    enabled: Boolean(meta.data?.connection?.id),
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: (body: CreateCampaignRequest) => campaignsApi.create(slug, body),
    onSuccess: () => {
      toast.success('Kampanya oluşturuldu');
      void qc.invalidateQueries({ queryKey: ['campaigns', slug] });
      setOpen(false);
      form.reset();
    },
  });

  const apiError = create.error instanceof ApiError ? create.error : null;

  const onSubmit = (values: FormValues): void => {
    const cents = Math.round(Number(values.budgetMajor) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      form.setError('budgetMajor', { message: 'Pozitif bir rakam gir' });
      return;
    }
    const body: CreateCampaignRequest = {
      adAccountId: values.adAccountId,
      name: values.name,
      objective: values.objective,
      status: values.status,
      ...(values.budgetKind === 'daily'
        ? { dailyBudgetCents: cents.toString() }
        : { lifetimeBudgetCents: cents.toString() }),
    };
    // Validate against the shared schema for belt-and-braces.
    const parsed = createCampaignRequestSchema.safeParse(body);
    if (!parsed.success) {
      form.setError('budgetMajor', { message: parsed.error.issues[0]?.message ?? 'Geçersiz' });
      return;
    }
    create.mutate(body);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button>Yeni kampanya</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni kampanya</DialogTitle>
          <DialogDescription>
            Bütçe Meta tarafına minor units (kuruş/cent) olarak gönderilir. Aşağıdaki alan major
            unit olarak — 50 yazarsan Meta 5000 cent görür.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e);
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
              name="adAccountId"
              rules={{ required: 'Reklam hesabı seç' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reklam hesabı</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                    >
                      <option value="">Seç…</option>
                      {adAccounts.data?.adAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              rules={{
                required: 'Ad gerekli',
                minLength: { value: 1, message: 'En az 1 karakter' },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kampanya adı</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="objective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amaç</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                      >
                        {OBJECTIVES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Başlangıç durumu</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                      >
                        <option value="PAUSED">PAUSED (güvenli varsayılan)</option>
                        <option value="ACTIVE">ACTIVE</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="budgetKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bütçe türü</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm"
                      >
                        <option value="daily">Günlük</option>
                        <option value="lifetime">Toplam (lifetime)</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetMajor"
                rules={{ required: 'Bütçe gerekli' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bütçe (major unit)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Suppresses the "Label is unused" warning when this file is imported in a
// context that doesn't need it — kept as future extension point for adding
// optional fields (start/end dates) later.
export const __unusedLabel: typeof Label = Label;
