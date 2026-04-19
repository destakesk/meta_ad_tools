import { z } from 'zod';

export const revokedReasonSchema = z.enum([
  'rotation',
  'user_logout',
  'password_change',
  'password_reset',
  'admin_revoke',
  'theft_detected',
  'expired_cleanup',
]);
export type RevokedReason = z.infer<typeof revokedReasonSchema>;

export const sessionListItemSchema = z.object({
  id: z.string(),
  device: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  lastUsedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  isCurrent: z.boolean(),
});
export type SessionListItem = z.infer<typeof sessionListItemSchema>;

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionListItemSchema),
});
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
