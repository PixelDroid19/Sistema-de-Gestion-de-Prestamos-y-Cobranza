import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { useAssociateDetails } from '../associateService';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const jsonResponse = (data: unknown) => ({ data, status: 200, headers: new Headers() });

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('associateService', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation(async (url) => {
      if (url === '/associates/12/financial-details') {
        return jsonResponse({ data: { details: { associate: { id: 12, name: 'Socio QA' } } } });
      }

      return jsonResponse({ data: {} });
    });
    mockPost.mockResolvedValue(jsonResponse({ success: true }));
  });

  it('loads associate financial details through the administrative details route', async () => {
    const { result } = renderHook(() => useAssociateDetails(12), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/associates/12/financial-details');
    });

    expect(mockGet).not.toHaveBeenCalledWith('/associates/12/portal');

    await waitFor(() => {
      expect(result.current.details?.associate?.id).toBe(12);
    });
    expect('portal' in result.current).toBe(false);
  });

  it('loads associate calendar events with the selected operational date range', async () => {
    renderHook(() => useAssociateDetails(12, {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/associates/12/calendar-events', {
        params: {
          startDate: '2026-05-01',
          endDate: '2026-05-31',
        },
      });
    });
  });

  it('sends actual payment details when marking an associate installment as paid', async () => {
    const { result } = renderHook(() => useAssociateDetails(12), { wrapper });

    result.current.payInstallment.mutate({
      installmentNumber: 3,
      paymentDate: '2026-05-16',
      paymentMethod: 'transferencia',
      notes: 'Pago confirmado',
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/associates/12/installments/3/pay', {
        paymentDate: '2026-05-16',
        paymentMethod: 'transferencia',
        notes: 'Pago confirmado',
      });
    });
  });
});
