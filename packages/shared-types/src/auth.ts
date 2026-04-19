import { z } from 'zod';

export const emailSchema = z.string().email().max(255);

/**
 * Password policy per NIST 800-63B:
 *   - min 12 chars
 *   - at least one upper, one lower, one digit
 *   - special character not required
 *
 * zxcvbn score ≥ 3 is enforced server-side only (async, dictionary-backed).
 * Substring checks against email-local and fullName also server-side.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Şifre en az 12 karakter olmalı')
  .max(128)
  .regex(/[A-Z]/, 'En az bir büyük harf')
  .regex(/[a-z]/, 'En az bir küçük harf')
  .regex(/[0-9]/, 'En az bir rakam');

export const fullNameSchema = z.string().min(2).max(100);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  invitationToken: z.string().optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginSuccessSchema = z.object({
  step: z.literal('success'),
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export const mfaChallengeResponseSchema = z.object({
  step: z.literal('mfa_challenge'),
  mfaChallengeToken: z.string(),
});
export const mfaSetupRequiredResponseSchema = z.object({
  step: z.literal('mfa_setup_required'),
  mfaSetupToken: z.string(),
});
export const loginResponseSchema = z.discriminatedUnion('step', [
  loginSuccessSchema,
  mfaChallengeResponseSchema,
  mfaSetupRequiredResponseSchema,
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const mfaSetupInitResponseSchema = z.object({
  secret: z.string(),
  qrCodeDataUrl: z.string(),
  issuer: z.string(),
  label: z.string(),
});
export type MfaSetupInitResponse = z.infer<typeof mfaSetupInitResponseSchema>;

export const mfaSetupRequestSchema = z.object({
  mfaSetupToken: z.string(),
  totpCode: z.string().regex(/^\d{6}$/),
});
export type MfaSetupRequest = z.infer<typeof mfaSetupRequestSchema>;

export const mfaVerifyRequestSchema = z.object({
  mfaChallengeToken: z.string(),
  code: z.string().min(6).max(11),
});
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

export const mfaBackupCodesResponseSchema = z.object({
  backupCodes: z.array(z.string()).length(10),
});
export type MfaBackupCodesResponse = z.infer<typeof mfaBackupCodesResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const emailVerifyRequestSchema = z.object({ token: z.string() });
export type EmailVerifyRequest = z.infer<typeof emailVerifyRequestSchema>;

export const resendVerificationRequestSchema = z.object({ email: emailSchema });
export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

export const mfaDisableRequestSchema = z.object({
  password: z.string().min(1),
  totpCode: z.string().regex(/^\d{6}$/),
});
export type MfaDisableRequest = z.infer<typeof mfaDisableRequestSchema>;

export const regenerateBackupCodesRequestSchema = z.object({
  password: z.string().min(1),
});
export type RegenerateBackupCodesRequest = z.infer<typeof regenerateBackupCodesRequestSchema>;
