import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Associates from '../Associates';

const updateAssociateMutateAsync = vi.fn();
const deleteAssociateMutateAsync = vi.fn();
const restoreAssociateMutateAsync = vi.fn();
const useAssociatesSpy = vi.fn();
const confirmDanger = vi.fn();

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

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => confirmDanger(...args),
}));

vi.mock('../../services/reportService', () => ({
  exportAssociatesExcel: vi.fn(),
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

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, correo o teléfono...'), {
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

  it('routes the edit action to the associate edit form', () => {
    const setCurrentView = vi.fn();
    render(<Associates setCurrentView={setCurrentView} />);

    fireEvent.click(screen.getByTitle('Editar'));

    expect(setCurrentView).toHaveBeenCalledWith('associates/2/edit');
  });

  it('reactivates inactive associates through the active status patch flow', async () => {
    render(<Associates setCurrentView={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Reactivar'));

    await waitFor(() => {
      expect(restoreAssociateMutateAsync).toHaveBeenCalledWith(2);
    });
  });
});
