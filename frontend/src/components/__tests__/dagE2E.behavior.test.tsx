import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VariablesRegistryPage from '../VariablesRegistryPage';

const mockList = vi.fn();

vi.mock('../../services/variableService', () => ({
  variableService: {
    list: (params: any) => mockList(params),
  },
}));

describe('E2E: /formulas/variables route', () => {
  it('renders VariablesRegistryPage at /formulas/variables', async () => {
    mockList.mockResolvedValue({
      success: true,
      data: {
        variables: [
          { id: 1, name: 'rate', type: 'percent', source: 'system_core', value: '0.05', status: 'active' },
        ],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, pageSize: 10 },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/formulas/variables']}>
          <Routes>
            <Route path="/formulas/variables" element={<VariablesRegistryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Variables Registry')).toBeInTheDocument();
      expect(screen.getByText('rate')).toBeInTheDocument();
    });
  });
});
