import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { useCapitalPaymentPreview } from '../paymentService';

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const mockPost = vi.mocked(apiClient.post);

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('paymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({
      data: { data: { preview: { after: { installmentAmount: 115487 } } } },
      status: 200,
      headers: new Headers(),
    });
  });

  it('sends the selected operational date when previewing capital payment reductions', async () => {
    renderHook(() => useCapitalPaymentPreview({
      loanId: 15,
      amount: '324349',
      asOfDate: '2026-06-19',
      strategy: 'reduce_payment',
      newTermMonths: '5',
    }), { wrapper });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/payments/capital/preview', {
        loanId: 15,
        amount: '324349',
        asOfDate: '2026-06-19',
        strategy: 'reduce_payment',
        newTermMonths: '5',
      });
    });
  });
});
