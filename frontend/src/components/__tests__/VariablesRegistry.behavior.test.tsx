import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      {ui}
    </QueryClientProvider>
  );
}

const mockVariables = [
  { id: 1, name: 'rate', type: 'percent', source: 'system_core', value: '0.05', status: 'active' },
  { id: 2, name: 'score', type: 'integer', source: 'bureau_api', value: '750', status: 'active' },
  { id: 3, name: 'oldFee', type: 'currency', source: 'app_data', value: '100', status: 'deprecated' },
];

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
      expect(screen.getByText('rate')).toBeInTheDocument();
      expect(screen.getByText('score')).toBeInTheDocument();
      expect(screen.getByText('oldFee')).toBeInTheDocument();
    });
  });

  it('applies type filter and refetches', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expect(screen.getByText('rate')).toBeInTheDocument());

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

    await waitFor(() => expect(screen.getByText('rate')).toBeInTheDocument());

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

    await waitFor(() => expect(screen.getByText('rate')).toBeInTheDocument());

    const statusSelect = screen.getAllByRole('combobox')[2];
    fireEvent.change(statusSelect, { target: { value: 'deprecated' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: '', source: '', status: 'deprecated', page: 1, pageSize: 10 })
      );
    });
  });

  it('renders deprecated variables with line-through and Dep badge', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expect(screen.getByText('oldFee')).toBeInTheDocument());

    const oldFeeCell = screen.getByText('oldFee');
    expect(oldFeeCell.classList.contains('line-through')).toBe(true);

    // Find the Dep badge in the same row
    const row = oldFeeCell.closest('tr');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('Dep');
  });

  it('renders active status badge for active variables', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expect(screen.getByText('rate')).toBeInTheDocument());

    const rateCell = screen.getByText('rate');
    const row = rateCell.closest('tr');
    expect(row?.textContent).toContain('Active');
  });

  it('opens New Variable modal when CTA is clicked', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expect(screen.getByText('rate')).toBeInTheDocument());

    const newButton = screen.getByRole('button', { name: /new variable/i });
    fireEvent.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'New Variable' })).toBeInTheDocument();
    });
  });

  it('calls createVariable on modal submit', async () => {
    renderWithProviders(<VariablesRegistryPage />);

    await waitFor(() => expect(screen.getByText('rate')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /new variable/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'New Variable' })).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('e.g. rate');
    fireEvent.change(nameInput, { target: { value: 'newVar' } });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'newVar' })
      );
    });
  });
});
