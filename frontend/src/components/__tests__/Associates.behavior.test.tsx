import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Associates from '../Associates';
import { exportAssociatesExcel } from '../../services/reportService';

const updateAssociateMutateAsync = vi.fn();
const deleteAssociateMutateAsync = vi.fn();
const restoreAssociateMutateAsync = vi.fn();
const useAssociatesSpy = vi.fn();
const confirmDanger = vi.fn();
let mockSessionUser: {
  role: 'admin' | 'employee' | 'customer' | 'socio';
  permissions?: string[];
} | null = { role: 'admin', permissions: ['*'] };

vi.mock('../../services/associateService', () => ({
  useAssociates: (params: unknown) => useAssociatesSpy(params),
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
    error: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => confirmDanger(...args),
}));

vi.mock('../../services/reportService', () => ({
  exportAssociatesExcel: vi.fn(),
}));

vi.mock('../NewAssociate', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div>
      <p>Formulario de edición de socio</p>
      <button type="button" onClick={onBack}>Cerrar edición</button>
    </div>
  ),
}));

const buildAssociatesResponse = (associates: any[]) => ({
  data: {
    data: {
      associates,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: associates.length,
        totalPages: 1,
      },
      summary: {
        totalAssociates: associates.length,
        activeAssociates: associates.filter((associate) => associate.status === 'active').length,
        inactiveAssociates: associates.filter((associate) => associate.status === 'inactive').length,
        totalContributed: 2500000,
        monthlyInterestEstimate: 75000,
        participationAssigned: 25,
      },
    },
  },
  isLoading: false,
  isError: false,
  updateAssociate: {
    mutateAsync: updateAssociateMutateAsync,
  },
  deleteAssociate: {
    mutateAsync: deleteAssociateMutateAsync,
  },
  restoreAssociate: {
    mutateAsync: restoreAssociateMutateAsync,
  },
});

describe('Associates behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = { role: 'admin', permissions: ['*'] };
    confirmDanger.mockResolvedValue(true);
    useAssociatesSpy.mockImplementation(() => buildAssociatesResponse([
      {
        id: 2,
        name: 'Socio Dos',
        email: 'socio2@example.com',
        phone: '+573001112233',
        status: 'inactive',
        participationPercentage: '25.0000',
        loanCount: 3,
      },
    ]));
  });

  it('forwards search and status filters to the associates query', () => {
    render(<Associates setCurrentView={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, correo o teléfono…'), {
      target: { value: 'socio' },
    });
    fireEvent.change(screen.getByDisplayValue('Todos los estados'), {
      target: { value: 'inactive' },
    });

    const latestCall = useAssociatesSpy.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      page: 1,
      pageSize: 25,
      search: 'socio',
      status: 'inactive',
    });
  });

  it('exports the associates list with the selected status filter', async () => {
    render(<Associates setCurrentView={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue('Todos los estados'), {
      target: { value: 'inactive' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));

    await waitFor(() => {
      expect(exportAssociatesExcel).toHaveBeenCalledWith({ status: 'inactive' });
    });
  });

  it('opens the edit action in a modal without leaving the associates table', () => {
    const setCurrentView = vi.fn();
    render(<Associates setCurrentView={setCurrentView} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar socio' }));

    expect(screen.getByRole('heading', { name: 'Editar socio' })).toBeInTheDocument();
    expect(screen.getByText('Formulario de edición de socio')).toBeInTheDocument();
    expect(setCurrentView).not.toHaveBeenCalledWith('associates/2/edit');
  });

  it('renders the shared financial insight strip for associates', () => {
    render(<Associates setCurrentView={vi.fn()} />);

    expect(screen.getByText('Capital aportado')).toBeInTheDocument();
    expect(screen.getByText('Interés estimado')).toBeInTheDocument();
    expect(screen.getByText('Socios activos')).toBeInTheDocument();
    expect(screen.getAllByText('Participación').length).toBeGreaterThan(0);
    expect(screen.getByText('$ 2.500.000')).toBeInTheDocument();
  });

  it('reactivates inactive associates through the active status patch flow', async () => {
    render(<Associates setCurrentView={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reactivar socio' }));

    await waitFor(() => {
      expect(restoreAssociateMutateAsync).toHaveBeenCalledWith(2);
    });
  });

  it('does not expose a physical delete action for associate history', () => {
    render(<Associates setCurrentView={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));

    expect(screen.getByRole('menuitem', { name: 'Reactivar socio' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Historial de intereses pagados' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Fechas de pago de intereses' })).toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });

  it('hides mutation and export actions for employees with associates read-only permission', () => {
    mockSessionUser = { role: 'employee', permissions: ['SOCIOS_VIEW_ALL'] };

    render(<Associates setCurrentView={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Ver detalle del socio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nuevo socio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar socio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más acciones' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });
});
