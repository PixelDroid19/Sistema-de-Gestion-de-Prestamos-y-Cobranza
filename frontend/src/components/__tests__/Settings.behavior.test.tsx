import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from '../Settings';

const mockCreatePaymentMethod = vi.fn().mockResolvedValue(undefined);
const mockUpdatePaymentMethod = vi.fn().mockResolvedValue(undefined);
const mockDeletePaymentMethod = vi.fn().mockResolvedValue(undefined);
const mockCreateRatePolicy = vi.fn().mockResolvedValue(undefined);
const mockUpdateRatePolicy = vi.fn().mockResolvedValue(undefined);
const mockDeleteRatePolicy = vi.fn().mockResolvedValue(undefined);
const mockCreateLateFeePolicy = vi.fn().mockResolvedValue(undefined);
const mockUpdateLateFeePolicy = vi.fn().mockResolvedValue(undefined);
const mockDeleteLateFeePolicy = vi.fn().mockResolvedValue(undefined);
const mockToastError = vi.fn();

vi.mock('../../services/configService', () => ({
  useConfig: () => ({
    paymentMethods: [
      {
        id: 1,
        key: 'bank-transfer',
        name: 'Transferencia bancaria',
        label: 'Transferencia bancaria',
        type: 'bank_transfer',
        isActive: true,
        requiresReference: true,
      },
    ],
    ratePolicies: [
      {
        id: 11,
        label: 'Crédito estándar',
        minAmount: 0,
        maxAmount: 5000000,
        annualEffectiveRate: 60,
        priority: 10,
        isActive: true,
      },
    ],
    lateFeePolicies: [
      {
        id: 21,
        label: 'Mora simple',
        annualEffectiveRate: 24,
        lateFeeMode: 'SIMPLE',
        priority: 10,
        isActive: true,
      },
    ],
    isLoading: false,
    createPaymentMethod: { mutateAsync: mockCreatePaymentMethod, isPending: false },
    updatePaymentMethod: { mutateAsync: mockUpdatePaymentMethod, isPending: false },
    deletePaymentMethod: { mutateAsync: mockDeletePaymentMethod, isPending: false },
    createRatePolicy: { mutateAsync: mockCreateRatePolicy, isPending: false },
    updateRatePolicy: { mutateAsync: mockUpdateRatePolicy, isPending: false },
    deleteRatePolicy: { mutateAsync: mockDeleteRatePolicy, isPending: false },
    createLateFeePolicy: { mutateAsync: mockCreateLateFeePolicy, isPending: false },
    updateLateFeePolicy: { mutateAsync: mockUpdateLateFeePolicy, isPending: false },
    deleteLateFeePolicy: { mutateAsync: mockDeleteLateFeePolicy, isPending: false },
  }),
}));

vi.mock('../../services/userService', () => ({
  useUsers: () => ({
    data: { data: { users: [] } },
    registerWithPermissions: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock('../PermissionsTab', () => ({
  default: () => <div data-testid="permissions-tab">Gestión de permisos</div>,
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
    apiErrorSafe: vi.fn(),
  },
}));

const mockConfirmDanger = vi.fn().mockResolvedValue(true);

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => mockConfirmDanger(...args),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.local' } }),
}));

vi.mock('../../lib/guidedTours', () => ({
  hasGuideDefinition: () => true,
  startViewGuide: vi.fn(),
}));

describe('Settings operational configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only production configuration tabs and hides non-operational placeholders', () => {
    render(<Settings />);

    expect(screen.getByRole('heading', { name: 'Configuración operativa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Métodos de pago/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tasas de crédito/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Políticas de mora\s*1$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empleados y permisos/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajustes Generales/i })).not.toBeInTheDocument();
  });

  it('creates payment methods through the real config mutation', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Métodos de pago/i }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del método' }), { target: { value: 'Daviplata QA' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de método' }), { target: { value: 'other' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear método de pago' }));

    await waitFor(() => {
      expect(mockCreatePaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Daviplata QA',
          type: 'other',
          isActive: true,
        }),
      );
    });
  });

  it('blocks duplicated payment methods before sending the mutation', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Métodos de pago/i }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del método' }), {
      target: { value: 'Transferencia bancaria' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear método de pago' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Ya existe un método de pago con ese nombre.',
        }),
      );
    });
    expect(mockCreatePaymentMethod).not.toHaveBeenCalled();
  });

  it('blocks overlapping active rate policies with the same priority', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de política de tasa' }), {
      target: { value: 'Crédito solapado' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Monto mínimo de tasa' }), {
      target: { value: '1000000' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Monto máximo de tasa' }), {
      target: { value: '2000000' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tasa efectiva anual' }), {
      target: { value: '55' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Prioridad de tasa' }), {
      target: { value: '10' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('mismo rango y prioridad'),
        }),
      );
    });
    expect(mockCreateRatePolicy).not.toHaveBeenCalled();
  });

  it('blocks duplicated active late-fee policy priorities', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^Políticas de mora\s*1$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la política de mora' }), {
      target: { value: 'Mora QA alterna' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tasa de mora efectiva anual' }), {
      target: { value: '18' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Prioridad de política de mora' }), {
      target: { value: '10' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de mora' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('política de mora activa con esa prioridad'),
        }),
      );
    });
    expect(mockCreateLateFeePolicy).not.toHaveBeenCalled();
  });

  it('uses the same table surface pattern for policy tabs', () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.getByText('Crédito estándar')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Políticas de tasa' })).toBeInTheDocument();
    expect(document.querySelector('.data-table-surface')).toBeInTheDocument();
  });

  it('executes destructive payment-method actions through confirmation', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Métodos de pago/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(mockConfirmDanger).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Eliminar método de pago',
        }),
      );
      expect(mockDeletePaymentMethod).toHaveBeenCalledWith(1);
    });
  });
});
