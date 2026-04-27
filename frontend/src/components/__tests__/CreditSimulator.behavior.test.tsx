import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreditSimulator from '../CreditSimulator';

const mockNavigate = vi.fn();

const simulationInput = {
  amount: 2400000,
  interestRate: 48,
  termMonths: 18,
  lateFeeMode: 'SIMPLE' as const,
  startDate: '2026-04-26',
};

const baseSimulationResult = {
  calculationMethod: 'COMPOUND',
  graphVersionId: 8,
  lateFeeMode: 'SIMPLE' as const,
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
  schedule: [],
};

let simulationState = {
  input: simulationInput,
  result: baseSimulationResult,
  error: null,
  fieldErrors: {},
  isSimulating: false,
  isResultStale: false,
  setInput: vi.fn(),
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
  useActiveCreditSimulation: () => simulationState,
}));

describe('CreditSimulator behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulationState = {
      input: simulationInput,
      result: baseSimulationResult,
      error: null,
      fieldErrors: {},
      isSimulating: false,
      isResultStale: false,
      setInput: vi.fn(),
      simulate: vi.fn(),
    };
  });

  it('continues to the real registration route from the top CTA with the simulated scenario', async () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Usar este cálculo para registrar' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/credits/new', {
        state: {
          simulationInput,
          source: 'credit-calculator',
        },
      });
    });
  });

  it('continues to the real registration route from the lower CTA with the simulated scenario', async () => {
    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuar a registro' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/credits/new', {
        state: {
          simulationInput,
          source: 'credit-calculator',
        },
      });
    });
  });

  it('blocks both registration CTAs when the simulation result is stale', () => {
    simulationState = {
      ...simulationState,
      isResultStale: true,
    };

    render(
      <MemoryRouter>
        <CreditSimulator />
      </MemoryRouter>,
    );

    const topCta = screen.getByRole('button', { name: 'Usar este cálculo para registrar' });
    const lowerCta = screen.getByRole('button', { name: 'Continuar a registro' });

    expect(topCta).toBeDisabled();
    expect(lowerCta).toBeDisabled();

    fireEvent.click(topCta);
    fireEvent.click(lowerCta);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
