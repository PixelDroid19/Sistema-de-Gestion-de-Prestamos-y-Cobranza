import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeSessionStateStorage } from '../lib/safeStorage';

type AdministrativeRole = 'admin' | 'employee';

interface User {
  id: number;
  name: string;
  email: string;
  role: AdministrativeRole;
  permissions?: string[];
}

interface SessionState {
  // Access token - kept for API requests and restored per browser tab session
  accessToken: string | null;
  // Refresh token - used to obtain new access tokens
  refreshToken: string | null;
  user: User | null;
  hasHydrated: boolean;
  // Login with token pair from login/refresh endpoints
  login: (tokens: { accessToken: string; refreshToken: string; user: User }) => void;
  // Update just the access token (after refresh)
  updateAccessToken: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  markHydrated: () => void;
}

const isAdministrativeRole = (role: unknown): role is AdministrativeRole => role === 'admin' || role === 'employee';

/**
 * Validates that a persisted or API-provided identity belongs to an internal
 * backoffice user. Borrowers and investor associates are domain records, not
 * authenticated administrative sessions.
 */
export const isAdministrativeUser = (user: unknown): user is User => {
  if (!user || typeof user !== 'object') {
    return false;
  }

  return isAdministrativeRole((user as { role?: unknown }).role);
};

const sanitizeSession = (state: Partial<SessionState>): Partial<SessionState> => {
  if (!isAdministrativeUser(state.user)) {
    return {
      ...state,
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }

  return state;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: true,
      login: ({ accessToken, refreshToken, user }) => set(sanitizeSession({ accessToken, refreshToken, user })),
      updateAccessToken: (accessToken, refreshToken) => set((state) => {
        if (!isAdministrativeUser(state.user)) {
          return { accessToken: null, refreshToken: null, user: null };
        }

        return { accessToken, refreshToken };
      }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'lendflow-session',
      storage: createJSONStorage(() => safeSessionStateStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizeSession(persistedState as Partial<SessionState>),
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);
