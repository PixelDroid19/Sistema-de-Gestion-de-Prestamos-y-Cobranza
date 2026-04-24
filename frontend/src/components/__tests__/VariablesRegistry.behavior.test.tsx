import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import VariablesRegistryPage from '../VariablesRegistryPage';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../services/variableService', () => ({
  variableService: {
    list: (params: any) => mockList(params),
    create: (payload: any) => mockCreate(payload),
    update: (id: number, payload: any) => mockUpdate(id, payload),
    delete: (id: number) => mockDelete(id),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockVariables = [
  { id: 1, name: 'rate', type: 'percent', source: 'system_core', value: '0.05', status: 'active' },
  { id: 2, name: 'score', type: 'integer', source: 'bureau_api', value: '750', status: 'active' },
  { id: 3, name: 'oldFee', type: 'currency', source: 'app_data', value: '100', status: 'deprecated' },
];

const expectVariableRendered = (name: string) => {
  expect(screen.getAllByText(name).length).toBeGreaterThan(0);
};

describe('VariablesRegistryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      success: true,
      data: {
        variables: mockVariables,
        pagination: { totalItems: 3, totalPages: 1, currentPage: 1, pageSize: 10 },
      },
    });
    mockCreate.mockResolvedValue({ success: true });
    mockUpdate.mockResolvedValue({ success: true });
    mockDelete.mockResolvedValue({ success: true });
  });

  it('renders variables table with all rows', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => {
      expectVariableRendered('rate');
      expectVariableRendered('score');
      expectVariableRendered('oldFee');
    });
  });

  it('applies type filter and refetches', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('rate'));

    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'percent' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'percent', source: '', status: '', page: 1, pageSize: 10 })
      );
    });
  });

  it('applies source filter and refetches', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('rate'));

    const sourceSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(sourceSelect, { target: { value: 'bureau_api' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: '', source: 'bureau_api', status: '', page: 1, pageSize: 10 })
      );
    });
  });

  it('applies status filter and refetches', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('rate'));

    const statusSelect = screen.getAllByRole('combobox')[2];
    fireEvent.change(statusSelect, { target: { value: 'deprecated' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: '', source: '', status: 'deprecated', page: 1, pageSize: 10 })
      );
    });
  });

  it('renders deprecated variables with line-through and retired badge', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('oldFee'));

    const oldFeeCell = screen.getAllByText('oldFee').find((element) => element.classList.contains('line-through') && element.closest('tr'));
    expect(oldFeeCell).toBeDefined();
    if (!oldFeeCell) throw new Error('oldFee row not found');
    expect(oldFeeCell.classList.contains('line-through')).toBe(true);

    const row = oldFeeCell.closest('tr');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('Retirada');
  });

  it('renders active status badge for active variables in Spanish', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('rate'));

    const rateCell = screen.getAllByText('rate').find((element) => element.closest('tr'));
    expect(rateCell).toBeDefined();
    if (!rateCell) throw new Error('rate row not found');
    const row = rateCell.closest('tr');
    expect(row?.textContent).toContain('Activa');
  });

  it('opens New Variable modal when CTA is clicked', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('rate'));

    const newButton = screen.getByRole('button', { name: /nueva variable/i });
    fireEvent.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nueva variable' })).toBeInTheDocument();
    });
  });

  it('calls createVariable on modal submit', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expectVariableRendered('rate'));

    fireEvent.click(screen.getByRole('button', { name: /nueva variable/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nueva variable' })).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('ej. tasa_anual');
    fireEvent.change(nameInput, { target: { value: 'new_var' } });

    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new_var' })
      );
    });
  });
});
