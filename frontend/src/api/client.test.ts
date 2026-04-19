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
  useSessionStore: {
    getState: () => sessionState,
  },
}));

describe('apiClient refresh coordination', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionState.accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.signature';
    sessionState.refreshToken = 'refresh-token-1';
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
});
