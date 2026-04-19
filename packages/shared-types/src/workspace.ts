import { z } from 'zod';

/**
 * Slug values the system reserves for its own routes or first-party features.
 * Both the DTO validator (API) and the slug input (web) import this list.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'auth',
  'settings',
  'w',
  'status',
  'health',
  'login',
  'logout',
  'invite',
  'signup',
  'register',
  'verify-email',
  'forgot-password',
  'reset-password',
  'mfa',
  'public',
  'assets',
  'static',
];

export const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir')
  .refine((s) => !RESERVED_SLUGS.includes(s), {
    message: 'Bu slug sistem tarafından rezerve edilmiş',
  });

export const workspaceSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  slug: z.string(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(2).max(50),
  slug: slugSchema,
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const workspaceResponseSchema = z.object({
  workspace: workspaceSchema,
  userRole: z.enum(['ADMIN', 'MANAGER', 'VIEWER']),
});
export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
