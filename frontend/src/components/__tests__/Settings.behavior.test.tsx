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
      label: 'Crédito básico',
      minAmount: 0,
      maxAmount: 1000000,
      annualEffectiveRate: 36,
      priority: 'low',
      isActive: true,
    },
    {
      id: 12,
      label: 'Crédito medio',
      minAmount: 1000001,
      maxAmount: 5000000,
      annualEffectiveRate: 48,
      priority: 'medium',
      isActive: true,
    },
    {
      id: 13,
      label: 'Crédito alto',
      minAmount: 5000001,
      maxAmount: null,
      annualEffectiveRate: 60,
      priority: 'high',
      isActive: true,
    },
  ],
  lateFeePolicies: [
    {
      id: 21,
      label: 'Mora simple',
      annualEffectiveRate: 24,
      lateFeeMode: 'SIMPLE',
      priority: 'medium',
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
  const getTextboxByAriaLabel = (label: string) => screen.getAllByLabelText(label).find((node) => node.tagName === 'INPUT') as HTMLInputElement;

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

    fireEvent.click(screen.getByRole('button', { name: 'Crear empleado' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del empleado' }), {
      target: { value: 'Empleado Nuevo' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Correo de acceso' }), {
      target: { value: 'empleado.nuevo@test.local' },
    });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'Password123!' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Nuevo empleado' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Crear método' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Crear método' }));
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

  it('blocks overlapping active rate policies', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear rango de tasa' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de política de tasa' }), {
      target: { value: 'Crédito solapado' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto mínimo de tasa'), {
      target: { value: '1000000' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto máximo de tasa'), {
      target: { value: '2000000' },
    });
    fireEvent.change(getTextboxByAriaLabel('Tasa efectiva anual'), {
      target: { value: '55' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('cruza este rango'),
        }),
      );
    });
    expect(mockCreateRatePolicy).not.toHaveBeenCalled();
  });

  it('allows the first explicit rate range to replace the seeded catch-all rule', async () => {
    mockConfigState.ratePolicies = [
      {
        id: 99,
        label: 'Crédito estándar',
        minAmount: 0,
        maxAmount: null,
        annualEffectiveRate: 36,
        priority: 'medium',
        metadata: { seeded: true },
        isActive: true,
      },
    ];

    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear rango de tasa' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de política de tasa' }), {
      target: { value: 'Crédito estándar' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto mínimo de tasa'), {
      target: { value: '0' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto máximo de tasa'), {
      target: { value: '1000000' },
    });
    fireEvent.change(getTextboxByAriaLabel('Tasa efectiva anual'), {
      target: { value: '48' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockCreateRatePolicy).toHaveBeenCalledWith(expect.objectContaining({
        label: 'Crédito estándar',
        minAmount: 0,
        maxAmount: 1000000,
        annualEffectiveRate: 48,
        priority: 'medium',
      }));
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('rejects exponent-like credit rate values before saving rate policies', async () => {
    mockConfigState.ratePolicies = [];
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear rango de tasa' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de política de tasa' }), {
      target: { value: 'Crédito tasa ambigua' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto mínimo de tasa'), {
      target: { value: '0' },
    });
    fireEvent.change(getTextboxByAriaLabel('Tasa efectiva anual'), {
      target: { value: '1e2' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        description: 'Tasa efectiva anual debe estar entre 0 y 100.',
      }));
    });
    expect(mockCreateRatePolicy).not.toHaveBeenCalled();
  });

  it('keeps the last valid credit rate when exponent-like text is typed in configuration', () => {
    mockConfigState.ratePolicies = [];
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear rango de tasa' }));

    const rateInput = getTextboxByAriaLabel('Tasa efectiva anual');
    fireEvent.change(rateInput, { target: { value: '55' } });
    expect(rateInput).toHaveDisplayValue('55');

    fireEvent.change(rateInput, { target: { value: '1e1' } });
    expect(rateInput).toHaveDisplayValue('55');
  });

  it('rejects a catch-all credit rate range that would overlap existing ranges before saving', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear rango de tasa' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de política de tasa' }), {
      target: { value: 'Crédito global' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto mínimo de tasa'), {
      target: { value: '0' },
    });
    fireEvent.change(getTextboxByAriaLabel('Monto máximo de tasa'), {
      target: { value: '' },
    });
    fireEvent.change(getTextboxByAriaLabel('Tasa efectiva anual'), {
      target: { value: '50' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        description: 'Ya existe una política activa que cruza este rango. Ajusta los límites para que cada monto tenga una sola tasa.',
      }));
    });
    expect(mockCreateRatePolicy).not.toHaveBeenCalled();
  });

  it('keeps late-fee priority hidden while preserving backend default validation', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^Políticas de mora\s*1$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear política' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la política de mora' }), {
      target: { value: 'Mora QA alterna' },
    });
    fireEvent.change(getTextboxByAriaLabel('Tasa de mora efectiva anual'), {
      target: { value: '18' },
    });
    expect(screen.queryByRole('combobox', { name: 'Prioridad' })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de mora' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('política de mora activa con ese nivel'),
        }),
      );
    });
    expect(mockCreateLateFeePolicy).not.toHaveBeenCalled();
  });

  it('rejects exponent-like late-fee rate values before saving late-fee policies', async () => {
    mockConfigState.lateFeePolicies = [];
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^Políticas de mora\s*0$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear política' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la política de mora' }), {
      target: { value: 'Mora tasa ambigua' },
    });
    fireEvent.change(getTextboxByAriaLabel('Tasa de mora efectiva anual'), {
      target: { value: '1e2' },
    });
    expect(screen.queryByRole('combobox', { name: 'Prioridad' })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de mora' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        description: 'Tasa de mora efectiva anual debe estar entre 0 y 100.',
      }));
    });
    expect(mockCreateLateFeePolicy).not.toHaveBeenCalled();
  });

  it('keeps the last valid late-fee rate when exponent-like text is typed in configuration', () => {
    mockConfigState.lateFeePolicies = [];
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^Políticas de mora\s*0$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear política' }));

    const lateFeeRateInput = getTextboxByAriaLabel('Tasa de mora efectiva anual');
    fireEvent.change(lateFeeRateInput, { target: { value: '24' } });
    expect(lateFeeRateInput).toHaveDisplayValue('24');

    fireEvent.change(lateFeeRateInput, { target: { value: '1e1' } });
    expect(lateFeeRateInput).toHaveDisplayValue('24');
  });

  it('uses the same table surface pattern for policy tabs', () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.getByRole('heading', { name: 'Tasas automáticas por monto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear rango de tasa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear rango de tasa' }));
    expect(screen.getByRole('heading', { name: 'Nuevo rango de tasa' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Prioridad' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('heading', { name: 'Prueba de tasa' })).toBeInTheDocument();
    expect(screen.getAllByText(/1\.000\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.000\.001.*5\.000\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Desde.*5\.000\.001/).length).toBeGreaterThan(0);
    expect(getTextboxByAriaLabel('Monto para probar tasa')).toHaveValue('2.000.000');
    expect(screen.getAllByText('48% EA').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Crédito medio aplica a/)).toBeInTheDocument();
    expect(screen.getAllByText('Crédito medio').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('table', { name: 'Políticas de tasa' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Aplica a montos/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tasa anual/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Uso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Prioridad/ })).not.toBeInTheDocument();
    expect(document.querySelector('.data-table-surface')).toBeInTheDocument();
  });

  it('does not expose priority in late-fee policies', () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^Políticas de mora\s*1$/i }));

    expect(screen.queryByRole('columnheader', { name: /Prioridad/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear política' }));
    expect(screen.queryByRole('combobox', { name: 'Prioridad' })).not.toBeInTheDocument();
  });

  it('explains existing active rate conflicts instead of silently choosing one rule', () => {
    mockConfigState.ratePolicies = [
      baseConfigState.ratePolicies[0],
      {
        id: 99,
        label: 'Tasa sin tope',
        minAmount: 0,
        maxAmount: null,
        annualEffectiveRate: 36,
        priority: 'medium',
        isActive: true,
      },
    ];

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.getByText('Hay tasas activas que se cruzan.')).toBeInTheDocument();
    expect(screen.getByText(/Crédito básico y Tasa sin tope cubren montos en común/)).toBeInTheDocument();
    expect(screen.getAllByText('Conflicto').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Nuevo crédito queda bloqueado/)).toBeInTheDocument();
  });

  it('explains active gaps between configured rate ranges', () => {
    mockConfigState.ratePolicies = [
      baseConfigState.ratePolicies[0],
      baseConfigState.ratePolicies[2],
    ];

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.getByText('Hay montos sin tasa configurada.')).toBeInTheDocument();
    expect(screen.getByText(/Falta cubrir:.*1\.000\.001.*5\.000\.000/)).toBeInTheDocument();
  });

  it('does not mark a displayed amount segment as covered when that segment still has a real gap', () => {
    mockConfigState.ratePolicies = [
      {
        id: 31,
        label: 'Crédito operativo',
        minAmount: 1000000,
        maxAmount: 5000000,
        annualEffectiveRate: 61,
        priority: 'medium',
        isActive: true,
      },
    ];

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.getAllByText('Crea una regla activa para este tramo.')).toHaveLength(2);
    expect(screen.getByText(/Usa Crédito operativo/)).toBeInTheDocument();
  });

  it('hides archived seeded catch-all replacements from the operational rate table', () => {
    mockConfigState.ratePolicies = [
      {
        id: 90,
        label: 'Crédito estándar (reemplazada por rangos)',
        minAmount: 0,
        maxAmount: null,
        annualEffectiveRate: 36,
        priority: 'medium',
        isActive: false,
        metadata: { seeded: true, replacedByExplicitRateRange: true },
      },
      {
        id: 91,
        label: 'Crédito estándar (reemplazada por rangos)',
        minAmount: 0,
        maxAmount: null,
        annualEffectiveRate: 36,
        priority: 'medium',
        isActive: false,
        metadata: { seeded: true, replacedByExplicitRateRange: true },
      },
      baseConfigState.ratePolicies[0],
      baseConfigState.ratePolicies[1],
    ];

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));

    expect(screen.queryByText(/reemplazada por rangos/i)).not.toBeInTheDocument();
    expect(screen.getByText('Crédito básico')).toBeInTheDocument();
    expect(screen.getAllByText('Crédito medio').length).toBeGreaterThan(0);
  });

  it('edits an existing rate policy without treating the same policy as duplicated', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Tasas de crédito/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    expect(screen.getByRole('heading', { name: 'Editar rango de tasa' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre de política de tasa' })).toHaveValue('Crédito básico');

    fireEvent.change(getTextboxByAriaLabel('Tasa efectiva anual'), {
      target: { value: '58' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Crear política de tasa' }));

    await waitFor(() => {
      expect(mockUpdateRatePolicy).toHaveBeenCalledWith(expect.objectContaining({
        id: '11',
        annualEffectiveRate: 58,
        minAmount: 0,
        maxAmount: 1000000,
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
