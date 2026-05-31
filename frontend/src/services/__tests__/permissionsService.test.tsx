import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../api/client';
import { useResolvedPermissionNames } from '../permissionsService';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

describe('useResolvedPermissionNames', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('uses permissions already present in the session user without fetching', () => {
    const { result } = renderHook(() => useResolvedPermissionNames({
      role: 'employee',
      permissions: ['CREDITS_VIEW_ALL'],
    }));

    expect(result.current).toEqual(['CREDITS_VIEW_ALL']);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('loads current employee permissions when the session user has no permission payload', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          permissions: [{ permissionName: 'CREDITS_UPDATE' }, { permission: 'PAYMENTS_CREATE' }],
        },
      },
      status: 200,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useResolvedPermissionNames({ role: 'employee' }));

    await waitFor(() => {
      expect(result.current).toEqual(['CREDITS_UPDATE', 'PAYMENTS_CREATE']);
    });
    expect(mockGet).toHaveBeenCalledWith('/permissions/me');
  });

  it('loads current employee permissions when a persisted session has an empty permission payload', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          permissions: [{ permission: 'REPORTS_VIEW_ALL' }],
        },
      },
      status: 200,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useResolvedPermissionNames({
      role: 'employee',
      permissions: [],
    }));

    await waitFor(() => {
      expect(result.current).toEqual(['REPORTS_VIEW_ALL']);
    });
    expect(mockGet).toHaveBeenCalledWith('/permissions/me');
  });

  it('reloads current employee permissions when the session changes to another employee without permission payload', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          data: {
            permissions: [{ permission: 'CLIENTS_VIEW_ALL' }],
          },
        },
        status: 200,
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            permissions: [{ permission: 'REPORTS_VIEW_ALL' }],
          },
        },
        status: 200,
        headers: new Headers(),
      });

    const { result, rerender } = renderHook(
      ({ user }) => useResolvedPermissionNames(user),
      {
        initialProps: {
          user: { id: 1, role: 'employee' },
        },
      },
    );

    await waitFor(() => {
      expect(result.current).toEqual(['CLIENTS_VIEW_ALL']);
    });

    rerender({ user: { id: 2, role: 'employee' } });

    await waitFor(() => {
      expect(result.current).toEqual(['REPORTS_VIEW_ALL']);
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
