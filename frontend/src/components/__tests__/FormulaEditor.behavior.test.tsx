import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormulaEditorPage from '../FormulaEditorPage';
import { useBlockEditorStore } from '../../store/blockEditorStore';

const mockNavigate = vi.fn();
const mockListScopes = vi.fn();
const mockListGraphs = vi.fn();
const mockSaveGraph = vi.fn();
const mockSimulateGraph = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: undefined }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../services/dagService', () => ({
  dagService: {
    listScopes: () => mockListScopes(),
    listGraphs: (scopeKey: string) => mockListGraphs(scopeKey),
    saveGraph: (payload: any) => mockSaveGraph(payload),
    simulateGraph: (payload: any) => mockSimulateGraph(payload),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  useConfirm: () => ({ confirm: vi.fn(() => Promise.resolve(true)) }),
}));

const mockScope = {
  key: 'credit-simulation',
  label: 'Credito',
  description: 'Scope para simulacion',
  defaultName: 'Nueva formula',
  requiredInputs: ['amount', 'interestRate', 'termMonths'],
  requiredOutputs: ['lateFeeMode', 'schedule', 'summary'],
  simulationInput: {
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  },
  helpers: [
    { name: 'buildAmortizationSchedule', description: 'Genera tabla de amortizacion' },
    { name: 'summarizeSchedule', description: 'Resume la tabla en totales' },
  ],
  defaultGraph: {
    nodes: [
      { id: 'input_amount', kind: 'constant', label: 'Monto', outputVar: 'amount' },
      { id: 'input_rate', kind: 'constant', label: 'Tasa', outputVar: 'interestRate' },
      { id: 'schedule', kind: 'formula', label: 'Cronograma', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)', outputVar: 'schedule' },
      { id: 'summary', kind: 'formula', label: 'Resumen', formula: 'summarizeSchedule(schedule)', outputVar: 'summary' },
    ],
    edges: [
      { source: 'input_amount', target: 'schedule' },
      { source: 'input_rate', target: 'schedule' },
      { source: 'schedule', target: 'summary' },
    ],
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

function getNodeLabel(text: string) {
  const all = screen.getAllByText(text);
  return all.find((el) => el.classList.contains('text-sm') && el.classList.contains('font-semibold')) || all[0];
}

describe('FormulaEditorPage', () => {
  beforeEach(() => {
    useBlockEditorStore.getState().reset();
    mockListScopes.mockResolvedValue({
      success: true,
      data: { scopes: [mockScope] },
    });
    mockListGraphs.mockResolvedValue({
      success: true,
      data: { graphs: [] },
    });
    mockSaveGraph.mockResolvedValue({
      success: true,
      data: { graph: { id: 1, status: 'active' } },
    });
    mockSimulateGraph.mockResolvedValue({
      success: true,
      data: {
        simulation: {
          lateFeeMode: 'SIMPLE',
          summary: { totalPayable: 2200000 },
          schedule: [],
        },
      },
    });
    vi.clearAllMocks();
  });

  it('renders scope variables in left panel', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getByText('amount')).toBeInTheDocument();
      expect(screen.getByText('interestRate')).toBeInTheDocument();
      expect(screen.getByText('termMonths')).toBeInTheDocument();
    });
  });

  it('renders available helpers in left panel', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getByText('buildAmortizationSchedule')).toBeInTheDocument();
      expect(screen.getByText('summarizeSchedule')).toBeInTheDocument();
    });
  });

  it('renders graph nodes from default graph', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(getNodeLabel('Monto')).toBeInTheDocument();
      expect(getNodeLabel('Cronograma')).toBeInTheDocument();
    });
  });

  it('displays formula for formula nodes', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/buildAmortizationSchedule\(amount, interestRate, termMonths, startDate, lateFeeMode\)/i)
      ).toBeInTheDocument();
    });
  });

  it('selects a node when clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    fireEvent.click(getNodeLabel('Cronograma'));

    await waitFor(() => {
      expect(screen.getByText('Propiedades del nodo')).toBeInTheDocument();
    });
  });

  it('shows formula textarea when formula node is selected', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    fireEvent.click(getNodeLabel('Cronograma'));

    await waitFor(() => {
      const textarea = screen.getAllByRole('textbox').find(
        (el) => el.classList.contains('font-mono')
      );
      expect(textarea).toBeTruthy();
    });
  });

  it('updates node formula in store when textarea changes', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    fireEvent.click(getNodeLabel('Cronograma'));

    await waitFor(() => {
      expect(screen.getByText('Propiedades del nodo')).toBeInTheDocument();
    });

    const textarea = screen.getAllByRole('textbox').find(
      (el) => el.classList.contains('font-mono')
    ) as HTMLTextAreaElement;

    expect(textarea).toBeTruthy();
    fireEvent.change(textarea, { target: { value: 'newFormula()' } });

    expect(useBlockEditorStore.getState().graph?.nodes.find((n) => n.id === 'schedule')?.formula).toBe('newFormula()');
  });

  it('calls saveGraph when save button is clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    const saveButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveGraph).toHaveBeenCalledTimes(1);
    });
  });

  it('calls simulateGraph when simulate button is clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    const simulateButton = screen.getByRole('button', { name: /probar/i });
    fireEvent.click(simulateButton);

    await waitFor(() => {
      expect(mockSimulateGraph).toHaveBeenCalledTimes(1);
    });
  });

  it('shows graph stats in right panel', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    expect(screen.getByText(/Grafo actual/i)).toBeInTheDocument();
    expect(screen.getByText(/Credito/i)).toBeInTheDocument();
  });
});
