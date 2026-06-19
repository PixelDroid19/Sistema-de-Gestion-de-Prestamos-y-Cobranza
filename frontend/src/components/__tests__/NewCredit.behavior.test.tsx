import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewCredit from '../NewCredit';
import { getLocalDateInputValue } from '../../lib/dateInput';

const mockNavigate = vi.fn();
const mockCreateLoan = vi.fn();
const mockSetInput = vi.fn();
const mockSimulate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseActiveCreditSimulation = vi.fn();
const mockUseConfig = vi.fn();
let mockValidationErrors: Array<{ field: string; message: string }> = [];
let currentUser = { id: 1, role: 'admin', permissions: ['*'] } as {
  id: number;
  role: 'admin' | 'employee';
  permissions: string[];
};
const mockConfigState = {
  ratePolicies: [] as any[],
  lateFeePolicies: [] as any[],
};
let mockCustomers: any[] = [
  { id: 10, name: 'Cliente QA' },
];

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

let currentLocationState: typeof routeState | null = routeState;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: currentLocationState }),
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
        customers: mockCustomers,
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
  extractValidationErrors: () => mockValidationErrors,
}));

const selectCustomerTen = () => {
  fireEvent.focus(screen.getByRole('combobox', { name: 'Cliente' }));
  fireEvent.mouseDown(screen.getByRole('option', { name: /Número 10\b/ }));
};

describe('NewCredit behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    currentLocationState = routeState;
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
    mockCustomers = [
      { id: 10, name: 'Cliente QA' },
    ];
    mockValidationErrors = [];
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
    const liveRatePreview = container.querySelector('[data-tour="new-credit-policy-summary"]');
    expect(liveRatePreview).toBeInTheDocument();
    expect(liveRatePreview).toHaveTextContent('Lista para validar');
    expect(liveRatePreview).toHaveTextContent('40,00%');
    expect(liveRatePreview).toHaveTextContent('2,84%');
    expect(liveRatePreview).toHaveTextContent('40,00% EA -> 2,84% mensual equivalente');
    expect(liveRatePreview).toHaveTextContent('Tasa mayor a 1M');
    expect(container.querySelector('[data-tour="new-credit-rate-summary"]')).not.toBeInTheDocument();
    const financialSummary = container.querySelector('[data-tour="new-credit-calculation-snapshot"]');
    expect(financialSummary).toHaveTextContent('Tasa anual');
    expect(financialSummary).toHaveTextContent('40,00%');
    expect(financialSummary).toHaveTextContent('Tasa mensual');
    expect(financialSummary).toHaveTextContent('2,84%');
    expect(financialSummary).toHaveTextContent('Cuota mensual');
    expect(financialSummary).toHaveTextContent('16 meses');
    expect(financialSummary).not.toHaveTextContent('Resumen financiero');
    expect(financialSummary).not.toHaveTextContent('La tasa se resuelve por monto');
    expect(financialSummary).not.toHaveTextContent('Al registrar');
    expect(financialSummary).not.toHaveTextContent('Para cuotas mensuales');
    expect(financialSummary).not.toHaveTextContent('Pago mensual');
    expect(financialSummary).not.toHaveTextContent('1,33 años');
    expect(screen.queryByRole('spinbutton', { name: 'Tasa configurada' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-tour="new-credit-action-dock"]')).toHaveClass('floating-action-dock');
    expect(container.querySelector('[data-tour="new-credit-action-dock"]')).not.toHaveClass('sticky');
    expect(screen.queryByLabelText('Socio asignado')).not.toBeInTheDocument();

    selectCustomerTen();
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

  it('uses today as the default disbursement date when the screen opens without a preloaded scenario', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T15:00:00.000Z'));
    currentLocationState = null;

    render(<NewCredit onBack={vi.fn()} />);

    expect(mockUseActiveCreditSimulation).toHaveBeenCalledWith({
      initialInput: expect.objectContaining({
        startDate: getLocalDateInputValue(new Date('2026-05-27T15:00:00.000Z')),
        rateSource: 'policy',
        lateFeeSource: 'policy',
      }),
      autoRun: false,
    });
    expect(screen.getByText('Fecha de desembolso')).toBeInTheDocument();
  });

  it('uses a neutral customer label when the customer record has no display name', () => {
    mockCustomers = [
      { id: 10 },
    ];

    render(<NewCredit onBack={vi.fn()} />);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Cliente' }));
    expect(screen.getByRole('option', { name: /Cliente sin nombre · N\/A\s*Número 10 · Estado No especificado/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /#10/ })).not.toBeInTheDocument();
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

    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(screen.queryByText('Estado no clasificado')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Estado/i })).not.toBeInTheDocument();
    expect(screen.queryByText('manual_hold')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver todas las cuotas/i)).not.toBeInTheDocument();
  });

  it('guides the operator through customer, validation and registration readiness', () => {
    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.queryByLabelText('Estado de preparación del crédito')).not.toBeInTheDocument();
    expect(screen.queryByText('Regla activa')).not.toBeInTheDocument();
    expect(screen.queryByText('Regla v9')).not.toBeInTheDocument();
    expect(screen.queryByText('Selecciona el cliente que recibirá el crédito.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Acciones del nuevo crédito')).toBeInTheDocument();
    expect(screen.queryByText('Mora simple · 24% EA')).not.toBeInTheDocument();
    expect(screen.queryByText('Mora simple · solo si hay atraso')).not.toBeInTheDocument();

    selectCustomerTen();

    expect((screen.getByRole('combobox', { name: 'Cliente' }) as HTMLInputElement).value).toContain('Cliente QA');
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

    const liveRatePreview = container.querySelector('[data-tour="new-credit-policy-summary"]');
    expect(liveRatePreview).toBeInTheDocument();
    expect(liveRatePreview).toHaveTextContent('Buscando regla');
    expect(liveRatePreview).toHaveTextContent('Cargando las tasas activas para este monto.');
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

    selectCustomerTen();
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

  it('blocks validation when active late-fee policies share the same highest priority', async () => {
    mockConfigState.lateFeePolicies = [
      {
        id: 2,
        label: 'Mora simple A',
        annualEffectiveRate: 24,
        lateFeeMode: 'SIMPLE',
        isActive: true,
        priority: 'high',
      },
      {
        id: 3,
        label: 'Mora simple B',
        annualEffectiveRate: 28,
        lateFeeMode: 'COMPOUND',
        isActive: true,
        priority: 'high',
      },
    ];

    render(<NewCredit onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Validar crédito' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Conflicto de mora',
      }));
    });
    expect(mockSimulate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Registrar crédito' })).toBeDisabled();
  });

  it('does not expose a manual late-fee selector while creating a real credit', () => {
    render(<NewCredit onBack={vi.fn()} />);

    expect(screen.queryByRole('combobox', { name: 'Cálculo de mora' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mora simple · 24% EA')).not.toBeInTheDocument();
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

    const liveRatePreview = container.querySelector('[data-tour="new-credit-policy-summary"]');
    expect(liveRatePreview).toBeInTheDocument();
    expect(liveRatePreview).toHaveTextContent('Conflicto');
    expect(liveRatePreview).toHaveTextContent('Tasa estándar y Crédito estándar');

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
    const liveRatePreview = screen.getByLabelText('Vista previa de la tasa del crédito');
    expect(liveRatePreview).toHaveTextContent('Tasa validada');
    expect(liveRatePreview).toHaveTextContent('Tasa mayor a 1M');

    selectCustomerTen();
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

  it('does not expose raw backend validation messages when credit creation is rejected', async () => {
    mockValidationErrors = [
      {
        field: 'customerId',
        message: 'customerId must be a numeric borrower id',
      },
    ];
    mockCreateLoan.mockRejectedValueOnce(new Error('validation failed'));

    render(<NewCredit onBack={vi.fn()} />);

    selectCustomerTen();
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar crédito' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('Selecciona el cliente que recibirá el crédito.')).toBeInTheDocument();
    expect(screen.queryByText(/customerId must be/i)).not.toBeInTheDocument();
  });
});
