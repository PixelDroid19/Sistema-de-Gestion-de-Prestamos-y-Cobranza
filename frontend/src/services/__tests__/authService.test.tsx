import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { useSessionStore } from '../../store/sessionStore';
import { normalizeAuthProfilePayload, useAuth } from '../authService';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);
const jsonResponse = (data: unknown) => ({ data, status: 200, headers: new Headers() });

const qaUser = {
  id: 12,
  name: 'QA Admin',
  email: 'qa.admin@test.local',
  role: 'admin' as const,
  permissions: ['REPORTS_VIEW_ALL'],
};

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('authService', () => {
  beforeEach(() => {
    useSessionStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: true,
    });
    mockGet.mockReset();
    mockPut.mockReset();
  });

  afterEach(() => {
    act(() => {
      useSessionStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
        hasHydrated: true,
      });
    });
  });

  it('normalizes the administrative profile from the current backend payload shape', () => {
    expect(normalizeAuthProfilePayload({
      success: true,
      data: { user: qaUser },
    })).toEqual(qaUser);
  });

  it('accepts profile payloads where data is already the administrative user', () => {
    expect(normalizeAuthProfilePayload({
      success: true,
      data: qaUser,
    })).toEqual(qaUser);
  });

  it('returns null for malformed profile payloads instead of undefined', () => {
    expect(normalizeAuthProfilePayload({ success: true, data: {} })).toBeNull();
    expect(normalizeAuthProfilePayload({ success: true, user: { id: 99, role: 'customer' } })).toBeNull();
  });

  it('falls back to the current session user when the profile response is incomplete', async () => {
    useSessionStore.setState({
      accessToken: 'qa-token',
      refreshToken: 'qa-refresh-token',
      user: qaUser,
      hasHydrated: true,
    });
    mockGet.mockResolvedValue(jsonResponse({ success: true, data: {} }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/profile');
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual(qaUser);
    });
  });

  it('syncs the session user after a profile update succeeds', async () => {
    useSessionStore.setState({
      accessToken: 'qa-token',
      refreshToken: 'qa-refresh-token',
      user: qaUser,
      hasHydrated: true,
    });
    mockGet.mockResolvedValue(jsonResponse({ success: true, data: { user: qaUser } }));
    mockPut.mockResolvedValue(jsonResponse({
      success: true,
      data: {
        user: {
          ...qaUser,
          name: 'QA Admin Actualizado',
        },
      },
    }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.profile?.name).toBe('QA Admin');
    });

    await act(async () => {
      await result.current.updateProfile.mutateAsync({
        name: 'QA Admin Actualizado',
        email: qaUser.email,
      });
    });

    expect(useSessionStore.getState().user?.name).toBe('QA Admin Actualizado');
    expect(result.current.profile?.name).toBe('QA Admin Actualizado');
  });
});
