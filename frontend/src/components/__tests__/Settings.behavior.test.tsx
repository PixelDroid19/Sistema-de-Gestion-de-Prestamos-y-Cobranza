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
const mockRegisterWithPermissions = vi.fn().mockResolvedValue(undefined);
const mockDeactivateUser = vi.fn().mockResolvedValue(undefined);
const mockReactivateUser = vi.fn().mockResolvedValue(undefined);
const mockToastError = vi.fn();
const baseConfigState: {
  paymentMethods: any[];
  ratePolicies: any[];
  lateFeePolicies: any[];
} = {
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
};
const mockConfigState = structuredClone(baseConfigState);

vi.mock('../../services/configService', () => ({
  useConfig: () => ({
    paymentMethods: mockConfigState.paymentMethods,
    ratePolicies: mockConfigState.ratePolicies,
    lateFeePolicies: mockConfigState.lateFeePolicies,
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
    data: {
      data: {
        users: [
          {
            id: 7,
            name: 'Empleado Activo',
            email: 'empleado.activo@test.local',
            role: 'employee',
            isActive: true,
            createdAt: '2026-04-10T00:00:00.000Z',
          },
          {
            id: 8,
            name: 'Empleado Inactivo',
            email: 'empleado.inactivo@test.local',
            role: 'employee',
            isActive: false,
            createdAt: '2026-04-11T00:00:00.000Z',
          },
        ],
      },
    },
    registerWithPermissions: { mutateAsync: mockRegisterWithPermissions, isPending: false },
    deactivateUser: { mutateAsync: mockDeactivateUser, isPending: false },
    reactivateUser: { mutateAsync: mockReactivateUser, isPending: false },
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
    mockConfigState.paymentMethods = structuredClone(baseConfigState.paymentMethods);
    mockConfigState.ratePolicies = structuredClone(baseConfigState.ratePolicies);
    mockConfigState.lateFeePolicies = structuredClone(baseConfigState.lateFeePolicies);
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

  it('lets admins create employees and manage employee access status from settings', async () => {
    render(<Settings />);

    expect(screen.getByText('Empleados')).toBeInTheDocument();
    expect(screen.getByText('Activos')).toBeInTheDocument();
    expect(screen.getByText('Inactivos')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Empleados administrativos' })).toBeInTheDocument();
    expect(screen.getByText('Empleado Activo')).toBeInTheDocument();
    expect(screen.getByText('Empleado Inactivo')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del empleado' }), {
      target: { value: 'Empleado Nuevo' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Correo de acceso' }), {
      target: { value: 'empleado.nuevo@test.local' },
    });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'Password123!' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear empleado administrativo' }));

    await waitFor(() => {
      expect(mockRegisterWithPermissions).toHaveBeenCalledWith({
        name: 'Empleado Nuevo',
        email: 'empleado.nuevo@test.local',
        password: 'Password123!',
        role: 'employee',
        permissions: [],
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => {
      expect(mockConfirmDanger).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Desactivar empleado',
      }));
      expect(mockDeactivateUser).toHaveBeenCalledWith(7);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    await waitFor(() => {
      expect(mockReactivateUser).toHaveBeenCalledWith(8);
    });
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

    expect(screen.getByRole('heading', { name: 'Tasas automáticas por monto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cobertura y prueba' })).toBeInTheDocument();
    expect(screen.getAllByText(/1\.000\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Desde.*1\.000\.001/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Monto para probar tasa' })).toHaveValue(2000000);
    expect(screen.getAllByText('60% EA').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Esa tasa será la que vea el operador en Nuevo crédito/)).toBeInTheDocument();
    expect(screen.getAllByText('Crédito estándar').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('table', { name: 'Políticas de tasa' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Aplica a montos/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tasa anual/ })).toBeInTheDocument();
    expect(document.querySelector('.data-table-surface')).toBeInTheDocument();
  });

  it('explains existing active rate conflicts instead of silently choosing one rule', () => {
    mockConfigState.ratePolicies = [
      ...baseConfigState.ratePolicies,
      {
        id: 12,
        label: 'Tasa sin tope',
        minAmount: 0,
        maxAmount: null,
        annualEffectiveRate: 36,
        priority: 10,
        isActive: true,
      },
    ];

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.getByText('Hay tasas activas que se cruzan con el mismo orden.')).toBeInTheDocument();
    expect(screen.getByText(/Crédito estándar y Tasa sin tope cubren montos en común/)).toBeInTheDocument();
    expect(screen.getAllByText('Conflicto').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Nuevo crédito queda bloqueado/)).toBeInTheDocument();
  });

  it('edits an existing rate policy without treating the same policy as duplicated', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByRole('heading', { name: 'Editar tasa por monto' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre de política de tasa' })).toHaveValue('Crédito estándar');

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tasa efectiva anual' }), {
      target: { value: '58' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockUpdateRatePolicy).toHaveBeenCalledWith(expect.objectContaining({
        id: '11',
        annualEffectiveRate: 58,
        minAmount: 0,
        maxAmount: 5000000,
      }));
    });
    expect(mockCreateRatePolicy).not.toHaveBeenCalled();
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
