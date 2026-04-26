import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewCredit from '../NewCredit';

const mockNavigate = vi.fn();
const mockCreateLoan = vi.fn();
const mockSetInput = vi.fn();
const mockSimulate = vi.fn();
const mockToastSuccess = vi.fn();
const mockUseActiveCreditSimulation = vi.fn();

const routeState = {
  simulationInput: {
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
    ratePolicies: [],
    lateFeePolicies: [],
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
    error: vi.fn(),
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

    mockUseActiveCreditSimulation.mockReturnValue({
      input: routeState.simulationInput,
      result: {
        calculationMethod: 'COMPOUND',
        graphVersionId: 9,
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
    render(<NewCredit onBack={vi.fn()} />);

    expect(mockUseActiveCreditSimulation).toHaveBeenCalledWith({
      initialInput: routeState.simulationInput,
      autoRun: true,
    });
    expect(screen.getByText('Escenario precargado desde Previsualizar crédito')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Socio asignado'), { target: { value: '3' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar crédito' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockCreateLoan).toHaveBeenCalledWith({
        customerId: 10,
        associateId: 3,
        amount: 2300000,
        interestRate: 42,
        termMonths: 16,
        startDate: '2026-05-01',
        lateFeeMode: 'COMPOUND',
        annualLateFeeRate: 0,
        rateSource: 'manual',
        lateFeeSource: 'manual',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/credits/55');
    });
  });
});
