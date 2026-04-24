import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormulaEditorPage from '../FormulaEditorPage';
import { useBlockEditorStore } from '../../store/blockEditorStore';

const mockNavigate = vi.fn();
const mockListScopes = vi.fn();
const mockListGraphs = vi.fn();
const mockSaveGraph = vi.fn();
const mockCalculateGraph = vi.fn();
const mockToastError = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: undefined }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../services/dagService', () => ({
  dagService: {
    listScopes: () => mockListScopes(),
    listGraphs: (scopeKey: string) => mockListGraphs(scopeKey),
    saveGraph: (payload: any) => mockSaveGraph(payload),
    calculateGraph: (payload: any) => mockCalculateGraph(payload),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  useConfirm: () => ({ confirm: vi.fn(() => Promise.resolve(true)) }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: (opts: any) => mockToastError(opts),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockScope = {
  key: 'credit-simulation',
  label: 'Credito',
  description: 'Scope para calculo de credito',
  defaultName: 'Nueva formula',
  requiredInputs: ['amount', 'interestRate', 'termMonths'],
  requiredOutputs: ['lateFeeMode', 'schedule', 'summary'],
  calculationInput: {
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  },
  helpers: [],
  defaultGraph: {
    nodes: [
      { id: 'monthly_rate', kind: 'formula', label: 'Tasa mensual', formula: 'interestRate / 12', outputVar: 'monthly_rate' },
      { id: 'result', kind: 'output', label: 'Resultado final', formula: 'buildCreditResult(lateFeeMode, schedule, summary)', outputVar: 'result' },
    ],
    edges: [{ source: 'monthly_rate', target: 'result' }],
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
    mockCalculateGraph.mockResolvedValue({
      success: true,
      data: {
        calculation: {
          lateFeeMode: 'SIMPLE',
          summary: { installmentAmount: 210000, totalPayable: 2200000, totalInterest: 200000 },
          schedule: [],
        },
      },
    });
    vi.clearAllMocks();
  });

  it('renders scope variables in left panel', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Monto del credito').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Tasa anual').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Plazo en meses').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });

  it('renders logic block controls in left panel', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Si').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Si no, cuando').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('En cualquier otro caso').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows live test panel with inputs', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Validacion de credito/i)).toBeInTheDocument();
      expect(screen.getByText(/Datos del credito de prueba/i)).toBeInTheDocument();
    });
  });

  it('calls saveGraph when save button is clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Guardar|Save/i).length).toBeGreaterThanOrEqual(1);
    });

    const saveButtons = screen.getAllByRole('button', { name: /guardar|save/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockSaveGraph).toHaveBeenCalledTimes(1);
    });
  });

  it('calls calculateGraph when test button is clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Validar/i).length).toBeGreaterThanOrEqual(1);
    });

    const testButtons = screen.getAllByRole('button', { name: /validar/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(mockCalculateGraph).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message when evaluation fails', async () => {
    mockCalculateGraph.mockRejectedValueOnce(new Error('Evaluation failed: missing variable'));

    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Validar/i).length).toBeGreaterThanOrEqual(1);
    });

    const evalButtons = screen.getAllByRole('button', { name: /validar/i });
    fireEvent.click(evalButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Evaluation failed: missing variable/i)).toBeInTheDocument();
    });
  });

  it('renders the formula name input', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/nombre de la formula/i);
      expect(input).toBeInTheDocument();
    });
  });
});
