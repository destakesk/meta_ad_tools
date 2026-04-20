import { z } from 'zod';

/**
 * Module 07 — Ad contracts. Ad lives under an AdSet + references a
 * Creative (nullable because the creative may be deleted separately).
 */

export const adStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'UNKNOWN']);
export type AdStatus = z.infer<typeof adStatusSchema>;

export const adSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  adsetId: z.string(),
  creativeId: z.string().nullable(),
  metaAdId: z.string(),
  name: z.string(),
  status: adStatusSchema,
  effectiveStatus: z.string().nullable(),
  syncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Ad = z.infer<typeof adSchema>;

export const adListResponseSchema = z.object({ ads: z.array(adSchema) });
export type AdListResponse = z.infer<typeof adListResponseSchema>;

export const createAdRequestSchema = z.object({
  adsetId: z.string().min(1),
  creativeId: z.string().min(1),
  name: z.string().min(1).max(200),
  status: z.enum(['ACTIVE', 'PAUSED']).default('PAUSED'),
});
export type CreateAdRequest = z.infer<typeof createAdRequestSchema>;

export const updateAdRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  creativeId: z.string().min(1).optional(),
});
export type UpdateAdRequest = z.infer<typeof updateAdRequestSchema>;

export const adSyncResponseSchema = z.object({ syncedCount: z.number().int().min(0) });
export type AdSyncResponse = z.infer<typeof adSyncResponseSchema>;

const stringBigint = z.string().regex(/^-?\d+$/);

/**
 * Module 08 — per-ad insight row. Leaf-level metric shape; parent key is
 * `adId`.
 */
export const adInsightRowSchema = z.object({
  adId: z.string(),
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
export type AdInsightRow = z.infer<typeof adInsightRowSchema>;

export const adInsightListResponseSchema = z.object({
  rows: z.array(adInsightRowSchema),
  totals: z.object({
    impressions: stringBigint,
    clicks: stringBigint,
    spendCents: stringBigint,
    conversions: stringBigint,
  }),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AdInsightListResponse = z.infer<typeof adInsightListResponseSchema>;
