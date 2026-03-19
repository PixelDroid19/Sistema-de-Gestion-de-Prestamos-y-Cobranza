import { create } from 'zustand';
import sessionManager from '../utils/sessionManager';

const getInitialSessionState = () => {
  if (!sessionManager.isSessionValid()) {
    return { user: null, token: null, isReady: true };
  }

  const session = sessionManager.getSession();

  return {
    user: session?.userData || null,
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
      user: session?.userData || null,
      token: session?.token || null,
      isReady: true,
    });
  },
  login: ({ user, token }) => {
    sessionManager.initSession(token, user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isReady: true });
  },
  logout: () => {
    sessionManager.clearSession();
    set({ user: null, token: null, isReady: true });
  },
  syncUser: (user) => {
    const { token } = get();
    if (token) {
      sessionManager.initSession(token, user);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }

    set({ user });
  },
}));
