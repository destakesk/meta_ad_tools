import { z } from 'zod';

/**
 * Module 03 — Meta Ads connection contracts.
 *
 * Tokens themselves never cross the API boundary; the frontend only ever
 * sees connection metadata (display name, scopes, expiry, status, etc.).
 */

export const metaConnectionStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED']);
export type MetaConnectionStatus = z.infer<typeof metaConnectionStatusSchema>;

export const metaConnectionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  metaUserId: z.string(),
  displayName: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime().nullable(),
  status: metaConnectionStatusSchema,
  connectedById: z.string(),
  lastRotatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MetaConnection = z.infer<typeof metaConnectionSchema>;

export const metaConnectionResponseSchema = z.object({
  connection: metaConnectionSchema.nullable(),
});
export type MetaConnectionResponse = z.infer<typeof metaConnectionResponseSchema>;

export const metaAdAccountSchema = z.object({
  id: z.string(),
  metaAdAccountId: z.string(),
  name: z.string(),
  currency: z.string(),
  timezone: z.string().nullable(),
  status: z.string().nullable(),
  syncedAt: z.string().datetime(),
});
export type MetaAdAccount = z.infer<typeof metaAdAccountSchema>;

export const metaAdAccountListResponseSchema = z.object({
  adAccounts: z.array(metaAdAccountSchema),
});
export type MetaAdAccountListResponse = z.infer<typeof metaAdAccountListResponseSchema>;

export const oauthInitResponseSchema = z.object({
  authorizeUrl: z.string().url(),
  state: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type OAuthInitResponse = z.infer<typeof oauthInitResponseSchema>;

export const oauthCallbackRequestSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type OAuthCallbackRequest = z.infer<typeof oauthCallbackRequestSchema>;
