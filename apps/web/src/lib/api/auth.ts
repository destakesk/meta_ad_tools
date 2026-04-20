import { api } from './client';

import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MfaDisableRequest,
  MfaSetupInitResponse,
  MfaSetupRequest,
  MfaVerifyRequest,
  RegenerateBackupCodesRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SessionListResponse,
  UpdateProfileRequest,
} from '@metaflow/shared-types';

export const authApi = {
  register: (body: RegisterRequest) =>
    api.post<{ userId: string; emailVerificationRequired: true }>('/api/auth/register', body),

  login: (body: LoginRequest) => api.post<LoginResponse>('/api/auth/login', body),

  mfaSetupInit: (mfaSetupToken: string) =>
    api.get<MfaSetupInitResponse>(
      `/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(mfaSetupToken)}`,
    ),

  mfaSetup: (body: MfaSetupRequest) =>
    api.post<{ accessToken: string; expiresIn: number; backupCodes: string[] }>(
      '/api/auth/mfa/setup',
      body,
    ),

  mfaVerify: (body: MfaVerifyRequest) =>
    api.post<{ accessToken: string; expiresIn: number }>('/api/auth/mfa/verify', body),

  logout: () => api.post<{ ok: true }>('/api/auth/logout'),
  logoutAll: () => api.post<{ ok: true; revokedCount: number }>('/api/auth/logout-all'),

  verifyEmail: (token: string) => api.post<{ ok: true }>('/api/auth/email/verify', { token }),

  forgotPassword: (body: ForgotPasswordRequest) =>
    api.post<{ ok: true }>('/api/auth/password/forgot', body),

  resetPassword: (body: ResetPasswordRequest) =>
    api.post<{ ok: true }>('/api/auth/password/reset', body),

  changePassword: (body: ChangePasswordRequest) =>
    api.post<{ ok: true }>('/api/auth/password/change', body),

  listSessions: () => api.get<SessionListResponse>('/api/auth/sessions'),
  revokeSession: (id: string) =>
    api.delete<{ ok: boolean; error?: { code: string; message: string } }>(
      `/api/auth/sessions/${id}`,
    ),

  me: () => api.get<MeResponse>('/api/users/me'),
  updateMe: (body: UpdateProfileRequest) =>
    api.patch<{ id: string; fullName: string; avatarUrl: string | null }>('/api/users/me', body),

  regenerateBackupCodes: (body: RegenerateBackupCodesRequest) =>
    api.post<{ backupCodes: string[] }>('/api/users/me/mfa/regenerate-backup-codes', body),
  disableMfa: (body: MfaDisableRequest) =>
    api.post<{ ok: true }>('/api/users/me/mfa/disable', body),
};
