import { create } from 'zustand';
import { normalizeSessionUser } from '@/utils/applicationRole';
import sessionManager from '@/utils/sessionManager';

const getInitialSessionState = () => {
  if (!sessionManager.isSessionValid()) {
    return { user: null, token: null, isReady: true };
  }

  const session = sessionManager.getSession();

  return {
    user: normalizeSessionUser(session?.userData),
    token: session?.token || null,
    isReady: true,
  };
};

export const useSessionStore = create((set, get) => ({
  ...getInitialSessionState(),
  bootstrapSession: () => {
    if (!sessionManager.isSessionValid()) {
      set({ user: null, token: null, isReady: true });
      return;
    }

    const session = sessionManager.getSession();
    set({
      user: normalizeSessionUser(session?.userData),
      token: session?.token || null,
      isReady: true,
    });
  },
  login: ({ user, token }) => {
    const normalizedUser = normalizeSessionUser(user);
    const session = sessionManager.initSession(token, normalizedUser);
    set({ user: session?.userData || null, token: session?.token || null, isReady: true });
  },
  logout: () => {
    sessionManager.clearSession();
    set({ user: null, token: null, isReady: true });
  },
  syncUser: (user) => {
    const { token } = get();
    const normalizedUser = normalizeSessionUser(user);

    if (!normalizedUser) {
      sessionManager.clearSession();
      set({ user: null, token: null, isReady: true });
      return;
    }

    if (token) {
      sessionManager.initSession(token, normalizedUser);
    }

    set({ user: normalizedUser });
  },
}));
