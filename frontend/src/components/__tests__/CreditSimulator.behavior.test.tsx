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
  useActiveCreditSimulation: () => ({
    input: simulationInput,
    result: {
      calculationMethod: 'COMPOUND',
      graphVersionId: 8,
      lateFeeMode: 'SIMPLE',
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
    },
    error: null,
    fieldErrors: {},
    isSimulating: false,
    isResultStale: false,
    setInput: vi.fn(),
    simulate: vi.fn(),
  }),
}));

describe('CreditSimulator behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues to the real registration route with the simulated scenario', async () => {
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
});
