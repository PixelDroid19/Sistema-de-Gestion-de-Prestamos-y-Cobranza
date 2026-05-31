import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '../../lib/toast';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import { useOperationalActions } from '../hooks/useOperationalActions';

vi.mock('../../lib/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../services/operationalGuards', () => ({
  resolveOperationalGuard: vi.fn(),
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: vi.fn(),
}));

const mockToastError = vi.mocked(toast.error);
const mockResolveOperationalGuard = vi.mocked(resolveOperationalGuard);

describe('useOperationalActions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('uses localized fallback copy when a non-safe guard has no reason', async () => {
    window.localStorage.setItem('app.locale', 'en');
    mockResolveOperationalGuard.mockReturnValue({ visible: false, executable: false });

    const { result } = renderHook(() => useOperationalActions(new QueryClient()));

    const executed = await result.current.executeGuardedAction({
      action: 'credit.delete',
      context: { role: 'employee' },
      run: vi.fn(),
    });

    expect(executed).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith({ title: 'Action unavailable' });
  });

  it('uses localized fallback copy for unexpected non-safe failures', async () => {
    window.localStorage.setItem('app.locale', 'en');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResolveOperationalGuard.mockReturnValue({ visible: true, executable: true });

    const { result } = renderHook(() => useOperationalActions(new QueryClient()));

    const executed = await result.current.executeGuardedAction({
      action: 'credit.delete',
      context: { role: 'admin', loanStatus: 'rejected' },
      run: vi.fn().mockRejectedValue(new Error('database field policy_id failed')),
    });

    expect(executed).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith({
      title: 'The action could not be completed',
      description: 'Try again in a few minutes.',
    });
  });
});
