import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'customer' | 'socio';
  phone?: string;
  associateId?: number;
  permissions?: string[];
}

interface SessionState {
  // Access token - used for API requests (stored in memory for security)
  accessToken: string | null;
  // Refresh token - used to obtain new access tokens
  refreshToken: string | null;
  user: User | null;
  // Login with token pair from login/refresh endpoints
  login: (tokens: { accessToken: string; refreshToken: string; user: User }) => void;
  // Update just the access token (after refresh)
  updateAccessToken: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      login: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      updateAccessToken: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'lendflow-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
        // Don't persist accessToken for security - it should be short-lived
      }),
    }
  )
);
