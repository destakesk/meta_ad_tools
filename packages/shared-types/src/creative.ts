import { z } from 'zod';

/**
 * Module 07 — Creative contracts. Creatives belong to a Meta ad account
 * and are reusable across ads. objectStorySpec is Meta's generic payload
 * (image hash, video id, link spec, etc.) — we pass it through as JSON.
 */

export const creativeKindSchema = z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'LINK', 'POST']);
export type CreativeKind = z.infer<typeof creativeKindSchema>;

export const creativeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  adAccountId: z.string(),
  metaCreativeId: z.string(),
  name: z.string(),
  kind: creativeKindSchema,
  thumbUrl: z.string().nullable(),
  objectStorySpec: z.unknown().nullable(),
  syncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Creative = z.infer<typeof creativeSchema>;

export const creativeListResponseSchema = z.object({ creatives: z.array(creativeSchema) });
export type CreativeListResponse = z.infer<typeof creativeListResponseSchema>;

export const createCreativeRequestSchema = z.object({
  adAccountId: z.string().min(1),
  name: z.string().min(1).max(200),
  kind: creativeKindSchema,
  thumbUrl: z.string().url().optional(),
  objectStorySpec: z.record(z.unknown()).optional(),
});
export type CreateCreativeRequest = z.infer<typeof createCreativeRequestSchema>;

export const creativeSyncResponseSchema = z.object({ syncedCount: z.number().int().min(0) });
export type CreativeSyncResponse = z.infer<typeof creativeSyncResponseSchema>;
