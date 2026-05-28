import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreditSimulator from '../CreditSimulator';
import type { CreditCalculationInput } from '../../types/creditCalculation';

const mockNavigate = vi.fn();
const mockSetInput = vi.fn();
const mockSyncInputWithResult = vi.fn();
const mockUseActiveCreditSimulation = vi.fn();

const calculationInput: CreditCalculationInput = {
  amount: 2400000,
  interestRate: 61,
  termMonths: 18,
  lateFeeMode: 'SIMPLE' as const,
  startDate: '2026-04-26',
  annualLateFeeRate: 28.17,
  rateSource: 'policy' as const,
  lateFeeSource: 'policy' as const,
};

const baseCalculationResult = {
  method: 'COMPOUND',
  calculationProfileVersionId: 8,
  lateFeeMode: 'SIMPLE' as const,
  inputs: calculationInput,
  policySnapshot: {
    rateSource: 'policy',
    lateFeeSource: 'policy',
  },
  summary: {
    installmentAmount: 210000,
    totalPrincipal: 2400000,
    totalInterest: 780000,
    totalPayable: 3180000,
    outstandingBalance: 3180000,
    outstandingPrincipal: 2400000,
    outstandingInterest: 780000,
    outstandingInstallments: 18,
    nextInstallment: null,
  },
  schedule: [] as any[],
};

let calculationState = {
  input: calculationInput,
  result: baseCalculationResult,
  error: null as string | null,
  fieldErrors: {},
  isSimulating: false,
  isResultStale: false,
  setInput: mockSetInput,
  syncInputWithResult: mockSyncInputWithResult,
  simulate: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useActiveCreditSimulation', () => ({
  DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT: {
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  },
  useActiveCreditSimulation: (...args: unknown[]) => mockUseActiveCreditSimulation(...args),
}));

describe('CreditSimulator behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationState = {
      input: calculationInput,
      result: baseCalculationResult,
      error: null,
      fieldErrors: {},
      isSimulating: false,
      isResultStale: false,
      setInput: mockSetInput,
      syncInputWithResult: mockSyncInputWithResult,
      simulate: vi.fn(),
    };
    mockUseActiveCreditSimulation.mockImplementation(() => calculationState);
  });

  it('continues to the real registration route from the top CTA with the simulated scenario', async () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Usar cálculo para registrar' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/credits/new', {
        state: {
          calculationInput,
          source: 'credit-calculator',
        },
      });
    });
  });

  it('runs the backend-backed calculation from the workspace CTA', async () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Calcular crédito' }));

    expect(calculationState.simulate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('starts the simulator in policy-backed mode and keeps rate and late-fee controls read-only', () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    expect(mockUseActiveCreditSimulation).toHaveBeenCalledWith({
      initialInput: expect.objectContaining({
        rateSource: 'policy',
        lateFeeSource: 'policy',
      }),
      autoRun: true,
    });
    expect(screen.getByDisplayValue('61')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Cálculo de mora' })).toBeDisabled();
    expect(screen.getByText(/La tasa se define con la regla vigente del negocio/i)).toBeInTheDocument();
    expect(screen.getByText(/La mora se define con la política vigente/i)).toBeInTheDocument();
  });

  it('synchronizes the visible rule fields with the backend-applied policy result', async () => {
    calculationState = {
      ...calculationState,
      input: {
        amount: 2400000,
        interestRate: 48,
        termMonths: 18,
        lateFeeMode: 'SIMPLE',
        startDate: '2026-04-26',
        annualLateFeeRate: 0,
        rateSource: 'manual',
        lateFeeSource: 'manual',
      },
      result: {
        ...baseCalculationResult,
        inputs: calculationInput,
        policySnapshot: {
          rateSource: 'policy',
          lateFeeSource: 'policy',
        },
      },
    };

    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockSyncInputWithResult).toHaveBeenCalledWith({
        interestRate: 61,
        annualLateFeeRate: 28.17,
        rateSource: 'policy',
        lateFeeSource: 'policy',
      });
    });
  });

  it('does not expose the internal calculation profile version in the simulation summary', () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Regla activa').length).toBeGreaterThan(0);
    expect(screen.queryByText(/v8/i)).not.toBeInTheDocument();
  });

  it('only exposes late-fee modes that the current settings UI can configure completely', () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    const lateFeeSelect = screen.getByRole('combobox', { name: 'Cálculo de mora' });

    expect(lateFeeSelect).toHaveTextContent('Sin recargo');
    expect(lateFeeSelect).toHaveTextContent('Mora simple');
    expect(lateFeeSelect).toHaveTextContent('Mora compuesta');
    expect(lateFeeSelect).not.toHaveTextContent('Cargo fijo por mora');
    expect(lateFeeSelect).not.toHaveTextContent('Mora por tramos');
  });

  it('uses an operational fallback for unknown simulated installment statuses', () => {
    calculationState = {
      ...calculationState,
      result: {
        ...baseCalculationResult,
        schedule: [
          {
            installmentNumber: 1,
            dueDate: '2026-05-26',
            scheduledPayment: 210000,
            interestComponent: 90000,
            principalComponent: 120000,
            remainingBalance: 2280000,
            status: 'manual_hold',
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    expect(screen.getByText('Estado no clasificado')).toBeInTheDocument();
    expect(screen.queryByText('manual_hold')).not.toBeInTheDocument();
  });

  it('blocks registration when the simulation result is stale', () => {
    calculationState = {
      ...calculationState,
      isResultStale: true,
    };

    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    const topCta = screen.getByRole('button', { name: 'Usar cálculo para registrar' });

    expect(topCta).toBeDisabled();
    expect(screen.getByText(/Ejecuta nuevamente para actualizar los resultados/i)).toBeInTheDocument();
    expect(screen.queryByText('$210.000')).not.toBeInTheDocument();

    fireEvent.click(topCta);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not keep showing a stale configured rate when the current amount no longer has a valid policy result', () => {
    calculationState = {
      ...calculationState,
      input: {
        ...calculationInput,
        amount: 999999,
      },
      error: 'No active rate policy is available for this credit amount',
      isResultStale: true,
    };

    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    expect(screen.queryByDisplayValue('61')).not.toBeInTheDocument();
    expect(screen.getByText(/No active rate policy is available for this credit amount/i)).toBeInTheDocument();
  });
});
