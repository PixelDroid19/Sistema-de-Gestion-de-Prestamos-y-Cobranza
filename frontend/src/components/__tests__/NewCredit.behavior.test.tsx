import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewCredit from '../NewCredit';

const mockNavigate = vi.fn();
const mockCreateLoan = vi.fn();
const mockSetInput = vi.fn();
const mockSimulate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseActiveCreditSimulation = vi.fn();
const mockUseConfig = vi.fn();
let currentUser = { id: 1, role: 'admin', permissions: ['*'] } as {
  id: number;
  role: 'admin' | 'employee';
  permissions: string[];
};
const mockConfigState = {
  ratePolicies: [] as any[],
  lateFeePolicies: [] as any[],
};

const routeState = {
  calculationInput: {
    amount: 2300000,
    interestRate: 42,
    termMonths: 16,
    lateFeeMode: 'COMPOUND',
    startDate: '2026-05-01',
  },
  source: 'credit-calculator' as const,
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: routeState }),
}));

vi.mock('../../services/loanService', () => ({
  useLoans: () => ({
    createLoan: {
      mutateAsync: (...args: unknown[]) => mockCreateLoan(...args),
    },
  }),
}));

vi.mock('../../services/customerService', () => ({
  useCustomers: () => ({
    data: {
      data: {
        customers: [
          { id: 10, name: 'Cliente QA' },
        ],
      },
    },
  }),
}));

vi.mock('../../services/configService', () => ({
  useConfig: (...args: unknown[]) => mockUseConfig(...args),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

mockUseConfig.mockImplementation(() => ({
    ratePolicies: mockConfigState.ratePolicies,
    lateFeePolicies: mockConfigState.lateFeePolicies,
    isLoading: false,
}));

vi.mock('../hooks/useActiveCreditSimulation', () => ({
  DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT: {
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  },
  useActiveCreditSimulation: (...args: unknown[]) => mockUseActiveCreditSimulation(...args),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: vi.fn(),
    validationErrors: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../services/apiErrors', () => ({
  extractValidationErrors: () => [],
}));

describe('NewCredit behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigState.ratePolicies = [
      {
        id: 1,
        label: 'Tasa mayor a 1M',
        annualEffectiveRate: 40,
        minAmount: 1000000.01,
        maxAmount: null,
        isActive: true,
        priority: 1,
      },
    ];
    mockConfigState.lateFeePolicies = [];
    currentUser = { id: 1, role: 'admin', permissions: ['*'] };
    mockUseConfig.mockClear();
    mockUseConfig.mockImplementation(() => ({
      ratePolicies: mockConfigState.ratePolicies,
      lateFeePolicies: mockConfigState.lateFeePolicies,
      isLoading: false,
    }));

    mockUseActiveCreditSimulation.mockReturnValue({
      input: routeState.calculationInput,
      result: {
        inputs: {
          ...routeState.calculationInput,
          interestRate: 40,
          annualLateFeeRate: 0,
        },
        method: 'COMPOUND',
        calculationProfileVersionId: 9,
        lateFeeMode: 'COMPOUND',
        policySnapshot: {
          rateSource: 'policy',
          ratePolicyLabel: 'Tasa mayor a 1M',
          appliedInterestRate: 40,
          lateFeeSource: 'manual',
          appliedLateFeeMode: 'COMPOUND',
          appliedAnnualLateFeeRate: 0,
        },
        summary: {
          installmentAmount: 195000,
          totalPrincipal: 2300000,
          totalInterest: 820000,
          totalPayable: 3120000,
          outstandingBalance: 3120000,
          outstandingPrincipal: 2300000,
          outstandingInterest: 820000,
          outstandingInstallments: 16,
          nextInstallment: null,
        },
        schedule: [],
      },
      error: null,
      fieldErrors: {},
      isSimulating: false,
      isResultStale: false,
      setInput: mockSetInput,
      simulate: mockSimulate,
    });

    mockCreateLoan.mockResolvedValue({
      data: {
        loan: {
          id: 55,
        },
      },
    });
  });

  it('loads the scenario coming from preview mode and creates the credit on the resulting route', async () => {
    const { container } = render(<NewCredit onBack={vi.fn()} />);

    expect(mockUseActiveCreditSimulation).toHaveBeenCalledWith({
      initialInput: {
        ...routeState.calculationInput,
        rateSource: 'policy',
      },
      autoRun: true,
    });
    expect(mockUseConfig).toHaveBeenCalledWith({ enabled: true });
    expect(screen.getByText('Escenario precargado')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasa configurada')).toBeDisabled();
    expect(container.querySelector('[data-tour="new-credit-action-dock"]')).toHaveClass('fixed');
    expect(container.querySelector('[data-tour="new-credit-action-dock"]')).not.toHaveClass('sticky');
    expect(screen.queryByLabelText('Socio asignado')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar crédito' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockCreateLoan).toHaveBeenCalledWith({
        customerId: 10,
        amount: 2300000,
        interestRate: 40,
        termMonths: 16,
        startDate: '2026-05-01',
        lateFeeMode: 'COMPOUND',
        annualLateFeeRate: 0,
        rateSource: 'policy',
        lateFeeSource: 'manual',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/credits/55');
    });
  });

  it('guides the operator through customer, validation and registration readiness', () => {
    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.getByText('Preparación del crédito')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado de preparación del crédito')).toBeInTheDocument();
    expect(screen.getAllByText('Regla v9').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selecciona el cliente que recibirá el crédito.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Acciones del nuevo crédito')).toBeInTheDocument();
    expect(screen.getByText('La mora no se suma al desembolso ni a la cuota normal al crear el crédito.')).toBeInTheDocument();
    expect(screen.getByText('Cuándo se cobra')).toBeInTheDocument();
    expect(screen.getByText('Cómo se calcula')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });

    expect(screen.getByLabelText('Cliente')).toHaveValue('10');
    expect(screen.getByRole('button', { name: 'Registrar crédito' })).toBeEnabled();
  });

  it('shows a loading rate state instead of a false missing-policy warning while config loads', () => {
    const originalLateFeeMode = routeState.calculationInput.lateFeeMode;
    (routeState.calculationInput as any).lateFeeMode = undefined;
    mockUseConfig.mockImplementation(() => ({
      ratePolicies: [],
      lateFeePolicies: [],
      isLoading: true,
    }));

    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.getAllByText('Cargando tasas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cargando mora').length).toBeGreaterThan(0);
    expect(screen.getByText('Cargando las tasas configuradas antes de permitir la validación del crédito.')).toBeInTheDocument();
    expect(screen.getByText('Cargando la política de mora vigente. Esta configuración solo se usa si una cuota se atrasa.')).toBeInTheDocument();
    expect(screen.queryByText('Sin tasa configurada')).not.toBeInTheDocument();
    expect(screen.queryByText('Mora simple · 0% EA')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validar crédito' })).toBeDisabled();
    routeState.calculationInput.lateFeeMode = originalLateFeeMode;
  });

  it('blocks real credit creation when no active rate policy matches the current amount', async () => {
    mockConfigState.ratePolicies = [
      {
        id: 1,
        label: 'Tasa hasta 1M',
        annualEffectiveRate: 42,
        minAmount: 0,
        maxAmount: 1000000,
        isActive: true,
        priority: 1,
      },
    ];
    mockConfigState.lateFeePolicies = [
      {
        id: 2,
        label: 'Mora simple',
        annualEffectiveRate: 24,
        lateFeeMode: 'SIMPLE',
        isActive: true,
        priority: 1,
      },
    ];

    render(<NewCredit onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar crédito' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Falta política de tasa',
      }));
    });
    expect(mockCreateLoan).not.toHaveBeenCalled();
  });

  it('blocks validation when active rate policies overlap with the same priority', async () => {
    mockConfigState.ratePolicies = [
      {
        id: 1,
        label: 'Crédito estándar',
        annualEffectiveRate: 36,
        minAmount: 0,
        maxAmount: null,
        isActive: true,
        priority: 100,
      },
      {
        id: 2,
        label: 'Tasa estándar',
        annualEffectiveRate: 60,
        minAmount: 0,
        maxAmount: 5000000,
        isActive: true,
        priority: 100,
      },
    ];

    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.getAllByText('Conflicto de tasas').length).toBeGreaterThan(0);
    expect(screen.getByText(/Hay varias tasas activas para/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Validar crédito' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Conflicto de tasas',
      }));
    });
    expect(mockSimulate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Registrar crédito' })).toBeDisabled();
  });

  it('lets permissioned employees validate and register through backend-applied rate policies without reading admin config', async () => {
    currentUser = { id: 2, role: 'employee', permissions: ['CREDITS_CREATE'] };
    mockConfigState.ratePolicies = [];

    render(<NewCredit onBack={vi.fn()} />);

    expect(mockUseConfig).toHaveBeenCalledWith({ enabled: false });
    expect(screen.getByText('Configuración: Tasa mayor a 1M')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar crédito' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockCreateLoan).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 10,
        amount: 2300000,
        interestRate: 40,
        rateSource: 'policy',
      }));
    });
  });
});
