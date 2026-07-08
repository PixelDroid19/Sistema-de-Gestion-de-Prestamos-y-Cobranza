import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '../sessionStore';

describe('sessionStore administrative session contract', () => {
  beforeEach(() => {
    useSessionStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: true,
    });
    window.sessionStorage.clear();
  });

  it('stores admin and employee sessions', () => {
    useSessionStore.getState().login({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 1,
        name: 'Operador',
        email: 'operador@test.local',
        role: 'employee',
      },
    });

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 1,
        role: 'employee',
      },
    });
  });

  it('rejects customer and socio identities instead of persisting stale backoffice sessions', () => {
    for (const role of ['customer', 'socio'] as const) {
      useSessionStore.getState().login({
        accessToken: `${role}-access-token`,
        refreshToken: `${role}-refresh-token`,
        user: {
          id: role === 'customer' ? 2 : 3,
          name: role,
          email: `${role}@test.local`,
          role,
        } as never,
      });

      expect(useSessionStore.getState()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        user: null,
      });
    }
  });

  it('does not refresh tokens when the administrative user is missing', () => {
    useSessionStore.getState().updateAccessToken('orphan-access-token', 'orphan-refresh-token');

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  });

  it('refreshes tokens for an active administrative user', () => {
    useSessionStore.getState().login({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      user: {
        id: 1,
        name: 'Operador',
        email: 'operador@test.local',
        role: 'employee',
      },
    });

    useSessionStore.getState().updateAccessToken('new-access-token', 'new-refresh-token');

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 1,
        role: 'employee',
      },
    });
  });

  it('persists the active access token for the same browser tab session', () => {
    useSessionStore.getState().login({
      accessToken: 'session-access-token',
      refreshToken: 'session-refresh-token',
      user: {
        id: 3,
        name: 'Administrador QA',
        email: 'qa@test.local',
        role: 'admin',
      },
    });

    const persistedSession = window.sessionStorage.getItem('lendflow-session');

    expect(persistedSession).toContain('session-access-token');
    expect(persistedSession).toContain('session-refresh-token');
  });

  it('marks the session as hydrated when there is no persisted session', async () => {
    window.sessionStorage.clear();
    vi.resetModules();

    const { useSessionStore: freshSessionStore } = await import('../sessionStore');

    expect(freshSessionStore.getState().hasHydrated).toBe(true);
  });
});
