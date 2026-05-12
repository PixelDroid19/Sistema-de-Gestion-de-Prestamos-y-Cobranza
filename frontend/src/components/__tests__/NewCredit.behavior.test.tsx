import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewCredit from '../NewCredit';

const mockNavigate = vi.fn();
const mockCreateLoan = vi.fn();
const mockSetInput = vi.fn();
const mockSimulate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseActiveCreditSimulation = vi.fn();
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

vi.mock('../../services/associateService', () => ({
  useAssociates: () => ({
    data: {
      data: {
        associates: [
          { id: 3, name: 'Socio QA' },
        ],
      },
    },
  }),
}));

vi.mock('../../services/configService', () => ({
  useConfig: () => ({
    ratePolicies: mockConfigState.ratePolicies,
    lateFeePolicies: mockConfigState.lateFeePolicies,
    isLoading: false,
  }),
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

    mockUseActiveCreditSimulation.mockReturnValue({
      input: routeState.calculationInput,
      result: {
        method: 'COMPOUND',
        calculationProfileVersionId: 9,
        lateFeeMode: 'COMPOUND',
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
    expect(screen.getByText('Escenario precargado')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasa configurada')).toBeDisabled();
    expect(container.querySelector('[data-tour="new-credit-action-dock"]')).toHaveClass('sticky');
    expect(container.querySelector('[data-tour="new-credit-action-dock"]')).not.toHaveClass('fixed');

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Socio asignado'), { target: { value: '3' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar crédito' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockCreateLoan).toHaveBeenCalledWith({
        customerId: 10,
        associateId: 3,
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
    expect(screen.getByText('Selecciona el cliente que recibirá el crédito.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });

    expect(screen.getByLabelText('Cliente')).toHaveValue('10');
    expect(screen.getByText('Listo para registrar el crédito real.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar crédito' })).toBeEnabled();
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
});
