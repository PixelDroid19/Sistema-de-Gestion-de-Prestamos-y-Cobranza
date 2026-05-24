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
        priority: 'medium',
      },
    ];
    mockConfigState.lateFeePolicies = [
      {
        id: 2,
        label: 'Mora simple',
        annualEffectiveRate: 24,
        lateFeeMode: 'SIMPLE',
        isActive: true,
        priority: 'medium',
      },
    ];
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
          lateFeeMode: 'SIMPLE',
          annualLateFeeRate: 24,
        },
        method: 'COMPOUND',
        calculationProfileVersionId: 9,
        lateFeeMode: 'SIMPLE',
        policySnapshot: {
          rateSource: 'policy',
          ratePolicyLabel: 'Tasa mayor a 1M',
          appliedInterestRate: 40,
          lateFeeSource: 'policy',
          lateFeePolicyLabel: 'Mora simple',
          appliedLateFeeMode: 'SIMPLE',
          appliedAnnualLateFeeRate: 24,
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
        lateFeeSource: 'policy',
      },
      autoRun: true,
    });
    expect(mockUseConfig).toHaveBeenCalledWith({ enabled: true });
    expect(screen.getByText('Escenario precargado')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="new-credit-policy-summary"]')?.textContent).toContain('Tasa mayor a 1M');
    expect(screen.queryByRole('spinbutton', { name: 'Tasa configurada' })).not.toBeInTheDocument();
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
        lateFeeMode: 'SIMPLE',
        annualLateFeeRate: 24,
        rateSource: 'policy',
        lateFeeSource: 'policy',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/credits/55');
    });
  });

  it('uses an operational fallback for unknown preview installment statuses', () => {
    mockUseActiveCreditSimulation.mockReturnValue({
      input: routeState.calculationInput,
      result: {
        inputs: {
          ...routeState.calculationInput,
          interestRate: 40,
          lateFeeMode: 'SIMPLE',
          annualLateFeeRate: 24,
        },
        method: 'COMPOUND',
        calculationProfileVersionId: 9,
        lateFeeMode: 'SIMPLE',
        policySnapshot: {
          rateSource: 'policy',
          ratePolicyLabel: 'Tasa mayor a 1M',
          appliedInterestRate: 40,
          lateFeeSource: 'policy',
          lateFeePolicyLabel: 'Mora simple',
          appliedLateFeeMode: 'SIMPLE',
          appliedAnnualLateFeeRate: 24,
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
        schedule: [
          {
            installmentNumber: 1,
            dueDate: '2026-06-01',
            scheduledPayment: 195000,
            interestComponent: 76667,
            principalComponent: 118333,
            remainingBalance: 2181667,
            status: 'manual_hold',
          },
        ],
      },
      error: null,
      fieldErrors: {},
      isSimulating: false,
      isResultStale: false,
      setInput: mockSetInput,
      simulate: mockSimulate,
    });

    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.getByText('Estado no clasificado')).toBeInTheDocument();
    expect(screen.queryByText('manual_hold')).not.toBeInTheDocument();
  });

  it('guides the operator through customer, validation and registration readiness', () => {
    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.getByLabelText('Estado de preparación del crédito')).toBeInTheDocument();
    expect(screen.getAllByText('Regla activa').length).toBeGreaterThan(0);
    expect(screen.queryByText('Regla v9')).not.toBeInTheDocument();
    expect(screen.queryByText('Selecciona el cliente que recibirá el crédito.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Acciones del nuevo crédito')).toBeInTheDocument();
    expect(screen.getByText('Mora simple · 24% EA')).toBeInTheDocument();
    expect(screen.getByText('Mora simple · solo si hay atraso')).toBeInTheDocument();

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

    const { container } = render(<NewCredit onBack={vi.fn()} />);

    const policySummary = container.querySelector('[data-tour="new-credit-policy-summary"]')?.textContent || '';
    expect(policySummary).toContain('Cargando');
    expect(policySummary).toContain('Leyendo la política de mora vigente.');
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
        priority: 'medium',
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

  it('blocks validation when no active late-fee policy exists for real credit creation', async () => {
    mockConfigState.lateFeePolicies = [];

    render(<NewCredit onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Validar crédito' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Falta política de mora',
      }));
    });
    expect(mockSimulate).not.toHaveBeenCalled();
  });

  it('does not expose a manual late-fee selector while creating a real credit', () => {
    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.queryByRole('combobox', { name: 'Cálculo de mora' })).not.toBeInTheDocument();
    expect(screen.getByText('Mora simple · 24% EA')).toBeInTheDocument();
  });

  it('blocks validation when active rate policies overlap', async () => {
    mockConfigState.ratePolicies = [
      {
        id: 1,
        label: 'Crédito estándar',
        annualEffectiveRate: 36,
        minAmount: 0,
        maxAmount: null,
        isActive: true,
        priority: 'medium',
      },
      {
        id: 2,
        label: 'Tasa estándar',
        annualEffectiveRate: 60,
        minAmount: 0,
        maxAmount: 5000000,
        isActive: true,
        priority: 'high',
      },
    ];

    const { container } = render(<NewCredit onBack={vi.fn()} />);

    const policySummary = container.querySelector('[data-tour="new-credit-policy-summary"]')?.textContent || '';
    expect(policySummary).toContain('Conflicto de tasas');
    expect(policySummary).toContain('2 reglas activas se pisan');

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
    expect(screen.getAllByText('Tasa mayor a 1M').length).toBeGreaterThan(0);

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
