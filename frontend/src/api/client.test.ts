import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState = {
  accessToken: 'expired-access',
  refreshToken: 'refresh-token-1',
  user: { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin' as const },
  login: vi.fn(),
  updateAccessToken: vi.fn((accessToken: string, refreshToken: string) => {
    sessionState.accessToken = accessToken;
    sessionState.refreshToken = refreshToken;
  }),
  logout: vi.fn(() => {
    sessionState.accessToken = null as unknown as string;
    sessionState.refreshToken = null as unknown as string;
  }),
};

vi.mock('../store/sessionStore', () => ({
  isAdministrativeUser: (user: unknown) => {
    const role = (user as { role?: unknown } | null)?.role;
    return role === 'admin' || role === 'employee';
  },
  useSessionStore: {
    getState: () => sessionState,
  },
}));

describe('API base URL resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.__APP_CONFIG__ = undefined;
  });

  it('uses /api when no build-time or runtime API base is configured', async () => {
    const { API_BASE_URL } = await import('./client');

    expect(API_BASE_URL).toBe('/api');
  });

  it('converts VITE_API_URL backend origins into the API base path', async () => {
    vi.stubEnv('VITE_API_URL', 'https://backend-production.example.test/');

    const { API_BASE_URL } = await import('./client');

    expect(API_BASE_URL).toBe('https://backend-production.example.test/api');
  });

  it('keeps explicit VITE_API_BASE_URL values as the full API base', async () => {
    vi.stubEnv('VITE_API_URL', 'https://backend-origin.example.test');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/custom-api/');

    const { API_BASE_URL } = await import('./client');

    expect(API_BASE_URL).toBe('https://api.example.test/custom-api');
  });

  it('prefers runtime config over build-time env values', async () => {
    vi.stubEnv('VITE_API_URL', 'https://backend-origin.example.test');
    window.__APP_CONFIG__ = { apiBaseUrl: 'https://runtime.example.test/api/' };

    const { API_BASE_URL } = await import('./client');

    expect(API_BASE_URL).toBe('https://runtime.example.test/api');
  });
});

describe('apiClient refresh coordination', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    window.__APP_CONFIG__ = undefined;
    sessionState.accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.signature';
    sessionState.refreshToken = 'refresh-token-1';
    sessionState.user = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin' };
  });

  it('reuses a single refresh request for concurrent stale-token requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authHeader = init?.headers instanceof Headers
        ? init.headers.get('Authorization')
        : (init?.headers as Record<string, string> | undefined)?.Authorization;

      if (url.includes('/api/auth/refresh')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            accessToken: 'fresh-access',
            refreshToken: 'refresh-token-2',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (authHeader === 'Bearer fresh-access') {
        return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: { message: 'expired', statusCode: 401 } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    const [first, second] = await Promise.all([
      apiClient.get('/reports/dashboard'),
      apiClient.get('/reports/outstanding'),
    ]);

    expect(first.data).toEqual({ success: true, data: { ok: true } });
    expect(second.data).toEqual({ success: true, data: { ok: true } });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/auth/refresh'))).toHaveLength(1);
    expect(sessionState.updateAccessToken).toHaveBeenCalledWith('fresh-access', 'refresh-token-2');
    expect(sessionState.logout).not.toHaveBeenCalled();
  });

  it('does not try to refresh when login fails with invalid credentials', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/login')) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: 'Please enter correct email/password',
            statusCode: 401,
          },
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/auth/refresh')) {
        throw new Error('refresh should not be called');
      }

      return new Response(null, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    await expect(apiClient.post('/auth/login', {
      email: 'admin.formulas@test.local',
      password: 'bad-password',
    })).rejects.toMatchObject({
      message: 'Please enter correct email/password',
      statusCode: 401,
    });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/auth/refresh'))).toHaveLength(0);
    expect(sessionState.logout).not.toHaveBeenCalled();
  });

  it('refreshes stale tokens before administrative user provisioning requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authHeader = init?.headers instanceof Headers
        ? init.headers.get('Authorization')
        : (init?.headers as Record<string, string> | undefined)?.Authorization;

      if (url.includes('/api/auth/refresh')) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            accessToken: 'fresh-access',
            refreshToken: 'refresh-token-2',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/auth/register-with-permissions') && authHeader === 'Bearer fresh-access') {
        return new Response(JSON.stringify({
          success: true,
          data: { user: { id: 8, role: 'employee' } },
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: { message: 'expired', statusCode: 401 } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    const response = await apiClient.post('/auth/register-with-permissions', {
      name: 'Nuevo operador',
      email: 'operador@test.local',
      password: 'Admin123!',
      role: 'employee',
      permissions: [],
    });

    expect(response.status).toBe(201);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/auth/refresh'))).toHaveLength(1);
    expect(sessionState.updateAccessToken).toHaveBeenCalledWith('fresh-access', 'refresh-token-2');
  });

  it('uses an operational fallback when an API error payload has no message', async () => {
    sessionState.accessToken = 'fresh-access';
    sessionState.refreshToken = null as unknown as string;

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: false,
      error: {
        statusCode: 500,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    await expect(apiClient.get('/reports/dashboard')).rejects.toMatchObject({
      message: 'No se pudo completar la operación',
      statusCode: 500,
    });
  });

  it('logs out with session-safe copy instead of refreshing when the administrative user is missing', async () => {
    sessionState.accessToken = null as unknown as string;
    sessionState.refreshToken = 'orphan-refresh-token';
    sessionState.user = null as never;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/refresh')) {
        throw new Error('refresh should not be called without an administrative user');
      }

      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    await expect(apiClient.get('/reports/dashboard')).rejects.toMatchObject({
      message: 'Inicia sesión nuevamente para continuar.',
      statusCode: 401,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionState.logout).toHaveBeenCalled();
  });

  it('logs out with session-safe copy when a stale session has no refresh token', async () => {
    sessionState.accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.signature';
    sessionState.refreshToken = null as unknown as string;
    sessionState.user = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin' };

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: false,
      error: { message: 'expired', statusCode: 401 },
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    await expect(apiClient.get('/reports/dashboard')).rejects.toMatchObject({
      message: 'Inicia sesión nuevamente para continuar.',
      statusCode: 401,
    });

    expect(sessionState.logout).toHaveBeenCalled();
  });

  it('logs out with session-safe copy when the refresh response is incomplete', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/refresh')) {
        return new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: { message: 'expired', statusCode: 401 },
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { apiClient } = await import('./client');

    await expect(apiClient.get('/reports/dashboard')).rejects.toMatchObject({
      message: 'Inicia sesión nuevamente para continuar.',
      statusCode: 401,
    });

    expect(sessionState.logout).toHaveBeenCalled();
  });
});
