import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Customers from '../Customers';

const updateCustomerMutateAsync = vi.fn();
const deleteCustomerMutateAsync = vi.fn();
const useCustomersSpy = vi.fn();
const confirmDanger = vi.fn();
let mockSessionUser: {
  role: 'admin' | 'employee' | 'customer' | 'socio';
  permissions?: string[];
} | null = { role: 'admin', permissions: ['*'] };

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

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: mockSessionUser,
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
    mockSessionUser = { role: 'admin', permissions: ['*'] };
    confirmDanger.mockResolvedValue(true);
    useCustomersSpy.mockImplementation(() => buildCustomersResponse([
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

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, correo o documento…'), {
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

  it('hides mutation actions for employees with customer read-only permission', () => {
    mockSessionUser = { role: 'employee', permissions: ['CLIENTS_VIEW_ALL'] };

    render(<Customers setCurrentView={vi.fn()} />);

    expect(screen.getByTitle('Ver detalles')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nuevo cliente/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reactivar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });

  it('preserves legitimate customer names in the list instead of stripping dev-like syllables', () => {
    useCustomersSpy.mockImplementation(() => buildCustomersResponse([
      {
        id: 9,
        name: 'Devora Alvarez',
        email: 'devora@example.com',
        status: 'active',
        createdAt: '2026-04-26T00:00:00.000Z',
      },
    ]));

    render(<Customers setCurrentView={vi.fn()} />);

    expect(screen.getByText('Devora Alvarez')).toBeInTheDocument();
    expect(screen.queryByText('ora Alvarez')).not.toBeInTheDocument();
  });

  it('keeps internal customer identifiers out of the list table', () => {
    render(<Customers setCurrentView={vi.fn()} />);

    expect(screen.queryByRole('columnheader', { name: /^ID$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('CUS-2')).not.toBeInTheDocument();
  });

  it('uses a generic customer fallback instead of rendering the internal id', () => {
    useCustomersSpy.mockImplementation(() => buildCustomersResponse([
      {
        id: 44,
        name: '',
        email: '',
        status: 'active',
        createdAt: '2026-04-26T00:00:00.000Z',
      },
    ]));

    render(<Customers setCurrentView={vi.fn()} />);

    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.queryByText('Cliente #44')).not.toBeInTheDocument();
  });
});
