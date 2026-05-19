import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreditSimulator from '../CreditSimulator';

const mockNavigate = vi.fn();

const calculationInput = {
  amount: 2400000,
  interestRate: 48,
  termMonths: 18,
  lateFeeMode: 'SIMPLE' as const,
  startDate: '2026-04-26',
};

const baseCalculationResult = {
  method: 'COMPOUND',
  calculationProfileVersionId: 8,
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

let calculationState = {
  input: calculationInput,
  result: baseCalculationResult,
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
  useActiveCreditSimulation: () => calculationState,
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
});
