import { z } from 'zod';

/**
 * Module 04 — Campaigns + Insights contracts.
 *
 * Monetary fields travel as string-encoded BigInt minor units (cents /
 * kuruş) so the full Prisma BigInt range survives JSON round-tripping.
 * Frontend formats with Intl.NumberFormat on the currency from Campaign
 * itself.
 */

export const campaignStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'UNKNOWN']);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

const stringBigint = z.string().regex(/^-?\d+$/);

export const campaignSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  adAccountId: z.string(),
  metaAdAccountId: z.string(),
  metaCampaignId: z.string(),
  name: z.string(),
  objective: z.string().nullable(),
  status: campaignStatusSchema,
  dailyBudgetCents: stringBigint.nullable(),
  lifetimeBudgetCents: stringBigint.nullable(),
  currency: z.string().nullable(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  syncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const campaignListResponseSchema = z.object({
  campaigns: z.array(campaignSchema),
});
export type CampaignListResponse = z.infer<typeof campaignListResponseSchema>;

export const campaignSyncResponseSchema = z.object({
  syncedCount: z.number().int().min(0),
  adAccountIds: z.array(z.string()),
});
export type CampaignSyncResponse = z.infer<typeof campaignSyncResponseSchema>;

/**
 * Insight row shape returned by the API. Daily granularity, one row per
 * (campaign, date). Numbers that can exceed JS safe-integer (impressions,
 * spend for big accounts) are BigInt-as-string.
 */
export const insightRowSchema = z.object({
  campaignId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  impressions: stringBigint,
  clicks: stringBigint,
  spendCents: stringBigint,
  conversions: stringBigint,
  reach: stringBigint,
  frequency: z.number(),
  cpmCents: stringBigint.nullable(),
  ctr: z.number().nullable(),
});
export type InsightRow = z.infer<typeof insightRowSchema>;

export const insightListResponseSchema = z.object({
  rows: z.array(insightRowSchema),
  totals: z.object({
    impressions: stringBigint,
    clicks: stringBigint,
    spendCents: stringBigint,
    conversions: stringBigint,
  }),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type InsightListResponse = z.infer<typeof insightListResponseSchema>;

export const insightSyncRequestSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type InsightSyncRequest = z.infer<typeof insightSyncRequestSchema>;
