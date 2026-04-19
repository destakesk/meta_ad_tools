import { z } from 'zod';

import { emailSchema, passwordSchema, fullNameSchema } from './auth';

export const invitationPreviewSchema = z.object({
  email: z.string().email(),
  organizationName: z.string(),
  role: z.string(),
  expiresAt: z.string().datetime(),
  inviterName: z.string(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const invitationAcceptRequestSchema = z.object({
  token: z.string(),
  // Provided when the invited email does not yet have a user account.
  userData: z
    .object({
      email: emailSchema,
      password: passwordSchema,
      fullName: fullNameSchema,
    })
    .optional(),
});
export type InvitationAcceptRequest = z.infer<typeof invitationAcceptRequestSchema>;
