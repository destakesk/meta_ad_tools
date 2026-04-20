import { z } from 'zod';

export const auditActionSchema = z.enum([
  'auth.register',
  'auth.email.verified',
  'login.success',
  'login.failed',
  'login.locked',
  'mfa.setup.initiated',
  'mfa.setup.completed',
  'mfa.disabled',
  'mfa.verify.success',
  'mfa.verify.failed',
  'mfa.backup_code.used',
  'password.changed',
  'password.reset',
  'session.revoked',
  'member.invited',
  'member.joined',
  'member.removed',
  'member.role.changed',
  'workspace.created',
  'workspace.deleted',
  'workspace.renamed',
  'organization.renamed',
  'meta.oauth.initiated',
  'meta.oauth.callback.success',
  'meta.oauth.callback.failed',
  'meta.connection.connected',
  'meta.connection.rotated',
  'meta.connection.disconnected',
  'meta.adaccounts.synced',
  'campaign.synced',
  'campaign.created',
  'campaign.updated',
  'campaign.deleted',
  'adset.synced',
  'adset.created',
  'adset.updated',
  'adset.deleted',
  'ad.synced',
  'ad.created',
  'ad.updated',
  'ad.deleted',
  'creative.synced',
  'creative.created',
  'creative.deleted',
  'insights.fetched',
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const loginFailedReasonSchema = z.enum([
  'wrong_password',
  'user_not_found',
  'locked',
  'unverified_email',
  'mfa_required',
]);
export type LoginFailedReason = z.infer<typeof loginFailedReasonSchema>;

export const auditMetadataSchema = z.object({
  reason: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});
export type AuditMetadata = z.infer<typeof auditMetadataSchema>;
