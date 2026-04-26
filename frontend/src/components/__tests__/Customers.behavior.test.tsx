import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Customers from '../Customers';

const updateCustomerMutateAsync = vi.fn();
const deleteCustomerMutateAsync = vi.fn();
const useCustomersSpy = vi.fn();
const confirmDanger = vi.fn();

vi.mock('../../services/customerService', () => ({
  useCustomers: (params: unknown) => useCustomersSpy(params),
}));

vi.mock('../../store/paginationStore', () => ({
  usePaginationStore: () => ({
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => confirmDanger(...args),
}));

const buildCustomersResponse = (customers: any[]) => ({
  data: {
    data: {
      customers,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: customers.length,
        totalPages: 1,
      },
    },
  },
  isLoading: false,
  isError: false,
  updateCustomer: {
    mutateAsync: updateCustomerMutateAsync,
  },
  deleteCustomer: {
    mutateAsync: deleteCustomerMutateAsync,
  },
});

describe('Customers behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmDanger.mockResolvedValue(true);
    useCustomersSpy.mockImplementation((params) => buildCustomersResponse([
      {
        id: 2,
        name: 'Ana Cliente',
        email: 'ana@example.com',
        status: 'inactive',
        createdAt: '2026-04-26T00:00:00.000Z',
      },
    ]));
  });

  it('forwards search, status, and date filters to the customer query and hides unsupported pending status', () => {
    render(<Customers setCurrentView={vi.fn()} />);

    expect(screen.queryByRole('option', { name: 'Pendiente' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bloqueado' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, correo o documento...'), {
      target: { value: 'ana' },
    });
    fireEvent.change(screen.getByDisplayValue('Todos los estados'), {
      target: { value: 'inactive' },
    });
    fireEvent.change(screen.getByDisplayValue('Todo el tiempo'), {
      target: { value: 'month' },
    });

    const latestCall = useCustomersSpy.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      page: 1,
      pageSize: 25,
      search: 'ana',
      status: 'inactive',
      registeredWithin: 'month',
    });
  });

  it('reactivates inactive customers through status update instead of restore route', async () => {
    render(<Customers setCurrentView={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Reactivar'));

    await waitFor(() => {
      expect(updateCustomerMutateAsync).toHaveBeenCalledWith({ id: 2, status: 'active' });
    });
  });

  it('routes the edit action to the customer edit form', () => {
    const setCurrentView = vi.fn();
    render(<Customers setCurrentView={setCurrentView} />);

    fireEvent.click(screen.getByTitle('Editar'));

    expect(setCurrentView).toHaveBeenCalledWith('customers/2/edit');
  });
});
