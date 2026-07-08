import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { exportAssociateFinancialSummary, exportAssociatesExcel, useAssociateDetails, useAssociateTracking } from '../associateService';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const jsonResponse = (data: unknown) => ({ data, status: 200, headers: new Headers() });
const createObjectURL = vi.fn(() => 'blob:associate-export');
const revokeObjectURL = vi.fn();

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
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
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

  it('accepts associate detail payloads returned directly under data', async () => {
    mockGet.mockImplementation(async (url) => {
      if (url === '/associates/12/financial-details') {
        return jsonResponse({
          data: {
            associate: { id: 12, name: 'Socio QA' },
            summary: { totalContributed: 1000000 },
            payments: [{ id: 1, amount: 50000 }],
          },
        });
      }

      if (url === '/associates/12/installments') {
        return jsonResponse({
          data: {
            installments: [{ installmentNumber: 1, amount: 50000 }],
            summary: { totalPending: 50000 },
          },
        });
      }

      if (url === '/associates/12/calendar-events') {
        return jsonResponse({
          data: {
            events: [{ id: 'interest-1', eventType: 'interest_payment', amount: 50000 }],
            summary: { installmentCount: 1 },
          },
        });
      }

      return jsonResponse({ data: {} });
    });

    const { result } = renderHook(() => useAssociateDetails(12), { wrapper });

    await waitFor(() => {
      expect(result.current.details?.associate?.name).toBe('Socio QA');
    });

    expect(result.current.details?.payments).toHaveLength(1);
    expect(result.current.installments?.installments).toHaveLength(1);
    expect(result.current.calendar?.events).toHaveLength(1);
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

  it('loads associate tracking from the associates module', async () => {
    renderHook(() => useAssociateTracking({ status: 'active', search: 'ana' }), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/associates/tracking', {
        params: { status: 'active', search: 'ana' },
      });
    });

    expect(mockGet).not.toHaveBeenCalledWith('/reports/associates/export');
  });

  it('exports associates from the associates module instead of reports', async () => {
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          configurable: true,
          value: click,
        });
      }
      if (options?.is) {
        element.setAttribute('is', options.is);
      }
      return element;
    });
    mockGet.mockResolvedValueOnce(jsonResponse(new Blob(['xlsx'])));

    await exportAssociatesExcel({ search: 'socio qa', status: 'inactive' });

    expect(mockGet).toHaveBeenCalledWith('/associates/export', {
      responseType: 'blob',
      params: { search: 'socio qa', status: 'inactive' },
    });
    expect(mockGet).not.toHaveBeenCalledWith('/reports/associates/excel', expect.anything());
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:associate-export');

    createElement.mockRestore();
    appendChild.mockRestore();
    removeChild.mockRestore();
  });

  it('exports one associate financial summary from the associate detail route', async () => {
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          configurable: true,
          value: click,
        });
      }
      if (options?.is) {
        element.setAttribute('is', options.is);
      }
      return element;
    });
    mockGet.mockResolvedValueOnce(jsonResponse(new Blob(['xlsx'])));

    await exportAssociateFinancialSummary(12);

    expect(mockGet).toHaveBeenCalledWith('/associates/12/export', {
      responseType: 'blob',
      params: { format: 'xlsx' },
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect((appendChild.mock.calls[0]?.[0] as HTMLAnchorElement).download).toBe('associate-12-financial-summary.xlsx');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:associate-export');

    createElement.mockRestore();
    appendChild.mockRestore();
    removeChild.mockRestore();
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
