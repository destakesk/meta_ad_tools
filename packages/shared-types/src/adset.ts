import { z } from 'zod';

/**
 * Module 06 — AdSet contracts. Lives under a Campaign; mirrors the
 * BigInt-minor-units budget convention + write/delete permission split
 * introduced in Modules 04/05.
 */

export const adSetStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'UNKNOWN']);
export type AdSetStatus = z.infer<typeof adSetStatusSchema>;

const stringBigint = z.string().regex(/^-?\d+$/);

export const adSetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  metaAdSetId: z.string(),
  name: z.string(),
  status: adSetStatusSchema,
  optimizationGoal: z.string().nullable(),
  billingEvent: z.string().nullable(),
  dailyBudgetCents: stringBigint.nullable(),
  lifetimeBudgetCents: stringBigint.nullable(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  targeting: z.unknown().nullable(),
  syncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdSet = z.infer<typeof adSetSchema>;

export const adSetListResponseSchema = z.object({ adSets: z.array(adSetSchema) });
export type AdSetListResponse = z.infer<typeof adSetListResponseSchema>;

const budgetInput = z.union([z.number().int().min(0), stringBigint]);

export const createAdSetRequestSchema = z
  .object({
    campaignId: z.string().min(1),
    name: z.string().min(1).max(200),
    status: z.enum(['ACTIVE', 'PAUSED']).default('PAUSED'),
    optimizationGoal: z.string().min(1).max(100),
    billingEvent: z.string().min(1).max(100),
    dailyBudgetCents: budgetInput.optional(),
    lifetimeBudgetCents: budgetInput.optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    targeting: z.unknown().optional(),
  })
  .refine(
    (v) =>
      (v.dailyBudgetCents !== undefined && v.lifetimeBudgetCents === undefined) ||
      (v.dailyBudgetCents === undefined && v.lifetimeBudgetCents !== undefined),
    { message: 'Exactly one of dailyBudgetCents or lifetimeBudgetCents is required' },
  );
export type CreateAdSetRequest = z.infer<typeof createAdSetRequestSchema>;

export const updateAdSetRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  dailyBudgetCents: budgetInput.nullable().optional(),
  lifetimeBudgetCents: budgetInput.nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  targeting: z.unknown().optional(),
});
export type UpdateAdSetRequest = z.infer<typeof updateAdSetRequestSchema>;

export const adSetSyncResponseSchema = z.object({ syncedCount: z.number().int().min(0) });
export type AdSetSyncResponse = z.infer<typeof adSetSyncResponseSchema>;

/**
 * Module 08 — per-adset insight row. Same metric shape as the campaign
 * level; parent key is `adsetId` instead of `campaignId`.
 */
export const adSetInsightRowSchema = z.object({
  adsetId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  impressions: stringBigint,
  clicks: stringBigint,
  spendCents: stringBigint,
  conversions: stringBigint,
  reach: stringBigint,
  frequency: z.number(),
  cpmCents: stringBigint.nullable(),
  ctr: z.number().nullable(),
});
export type AdSetInsightRow = z.infer<typeof adSetInsightRowSchema>;

export const adSetInsightListResponseSchema = z.object({
  rows: z.array(adSetInsightRowSchema),
  totals: z.object({
    impressions: stringBigint,
    clicks: stringBigint,
    spendCents: stringBigint,
    conversions: stringBigint,
  }),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AdSetInsightListResponse = z.infer<typeof adSetInsightListResponseSchema>;
