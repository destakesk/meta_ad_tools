import { create } from 'zustand';

import type { MeResponse } from '@metaflow/shared-types';

type UserMe = MeResponse['user'];

interface AuthState {
  accessToken: string | null;
  user: UserMe | null;
  organizations: MeResponse['organizations'];
  setAccessToken: (token: string | null) => void;
  setMe: (me: MeResponse) => void;
  clear: () => void;
}

/**
 * Auth store — deliberately NOT persisted (no localStorage). On page load
 * the app bootstraps by calling POST /api/auth/refresh, which reads the
 * httpOnly cookie and returns a fresh access token.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  organizations: [],
  setAccessToken: (accessToken) => {
    set({ accessToken });
  },
  setMe: (me) => {
    set({ user: me.user, organizations: me.organizations });
  },
  clear: () => {
    set({ accessToken: null, user: null, organizations: [] });
  },
}));
