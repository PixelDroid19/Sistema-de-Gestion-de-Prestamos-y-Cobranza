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
    simulateGraph: (payload: any) => mockSimulateGraph(payload),
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
    { name: 'buildAmortizationSchedule', label: 'Generar tabla de amortización', description: 'Genera tabla de amortizacion' },
    { name: 'summarizeSchedule', label: 'Resumen de cronograma', description: 'Resume la tabla en totales' },
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
      expect(screen.getAllByText('amount').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('interestRate').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('termMonths').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });

  it('renders available helpers in left panel with friendly labels', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      // Use getAllByText because the label also appears inside node cards;
      // we just need to confirm it exists somewhere (panel + cards).
      expect(screen.getAllByText('Generar tabla de amortización').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Resumen de cronograma').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders graph nodes from default graph', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      expect(getNodeLabel('Monto')).toBeInTheDocument();
      expect(getNodeLabel('Cronograma')).toBeInTheDocument();
    });
  });

  it('displays friendly formula description for formula nodes', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => {
      // Should show the human-friendly label inside a chip, NEVER the raw function name
      const chips = screen.getAllByText(/Generar tabla de amortización/i);
      expect(chips.length).toBeGreaterThanOrEqual(1);
      // Ensure the raw function name is NOT present anywhere
      expect(screen.queryByText('buildAmortizationSchedule')).not.toBeInTheDocument();
    });
  });

  it('selects a node when clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    fireEvent.click(getNodeLabel('Cronograma'));

    await waitFor(() => {
      expect(screen.getByText('Propiedades')).toBeInTheDocument();
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
      expect(screen.getByText('Propiedades')).toBeInTheDocument();
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

  it('shows live test panel with scope info', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    expect(screen.getByText(/Live Test/i)).toBeInTheDocument();
    expect(screen.getByText(/Input Values/i)).toBeInTheDocument();
  });

  // ── New tests for untested spec scenarios ──

  it('adds a new block to canvas when dragged from toolbox', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    const toolboxItem = screen.getByText('IF / THEN / ELSE');
    // The canvas is the section element with onDrop handler
    const canvas = document.querySelector('section[ondrop]') || document.querySelector('section')!;

    // Simulate drag from toolbox to canvas
    fireEvent.dragStart(toolboxItem, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: 'copy',
      },
    });

    fireEvent.dragOver(canvas, {
      dataTransfer: {
        dropEffect: 'copy',
      },
    });

    fireEvent.drop(canvas, {
      dataTransfer: {
        getData: () => JSON.stringify({ kind: 'conditional', preset: 'if(condition, then, else)' }),
      },
      clientX: 500,
      clientY: 400,
    });

    await waitFor(() => {
      const store = useBlockEditorStore.getState();
      expect(store.graph?.nodes.some((n) => n.kind === 'conditional')).toBe(true);
    });
  });

  it('rejects incompatible block connections and shows toast error', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Monto')).toBeInTheDocument());

    // The default graph has 4 nodes: 2 constants, 2 formulas.
    // We'll try to connect one constant node to another constant node (incompatible)
    const outHandles = screen.getAllByTitle('Conectar salida');
    const inHandles = screen.getAllByTitle('Conectar entrada');

    // Click output handle of the second node (should be input_rate, a constant)
    fireEvent.mouseDown(outHandles[1]);

    // Click input handle of the first node (input_amount, a constant)
    // constant -> constant is invalid
    fireEvent.mouseDown(inHandles[0]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });

    // Ensure no edge was actually added between these two
    const edgesAfter = useBlockEditorStore.getState().graph?.edges || [];
    const sourceId = useBlockEditorStore.getState().graph?.nodes[1]?.id;
    const targetId = useBlockEditorStore.getState().graph?.nodes[0]?.id;
    expect(edgesAfter.some((e) => e.source === sourceId && e.target === targetId)).toBe(false);
  });

  it('shows error message with node trace when evaluation fails', async () => {
    mockSimulateGraph.mockRejectedValueOnce(new Error('Node trace: schedule -> summary failed'));

    renderWithProviders(<FormulaEditorPage />);

    await waitFor(() => expect(getNodeLabel('Cronograma')).toBeInTheDocument());

    const evaluateButton = screen.getByRole('button', { name: /evaluate formula/i });
    fireEvent.click(evaluateButton);

    await waitFor(() => {
      expect(screen.getByText(/Node trace: schedule -> summary failed/i)).toBeInTheDocument();
    });
  });
});
