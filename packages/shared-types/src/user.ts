import { z } from 'zod';

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  emailVerifiedAt: z.string().datetime().nullable(),
  mfaEnabled: z.boolean(),
  createdAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const meResponseSchema = z.object({
  user: userProfileSchema,
  mfaEnabled: z.boolean(),
  organizations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
    }),
  ),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const updateProfileRequestSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
