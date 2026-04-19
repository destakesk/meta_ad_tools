import { api } from './client';

import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MfaSetupInitResponse,
  MfaSetupRequest,
  MfaVerifyRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SessionListResponse,
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

  listSessions: () => api.get<SessionListResponse>('/api/auth/sessions'),
  revokeSession: (id: string) => api.delete<{ ok: boolean }>(`/api/auth/sessions/${id}`),

  me: () => api.get<MeResponse>('/api/users/me'),
};
