import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormulaEditorPage from '../FormulaEditorPage';
import { useBlockEditorStore } from '../../store/blockEditorStore';
import { CREDIT_FORMULA_TEMPLATES } from '../../lib/creditFormulaTemplates';

const mockNavigate = vi.fn();
const mockListScopes = vi.fn();
const mockListGraphs = vi.fn();
const mockSaveGraph = vi.fn();
const mockCalculateGraph = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();

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
    warning: (opts: any) => mockToastWarning(opts),
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

async function waitForEditorReady() {
  await screen.findByDisplayValue('Nueva formula');
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

  it('renders scope variables when tools are opened', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();
    const toolsButton = await screen.findByRole('button', { name: /datos disponibles/i });
    fireEvent.click(toolsButton);

    await waitFor(() => {
      expect(screen.getAllByText('Monto del credito').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Tasa anual').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Plazo en meses').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });

  it('lets operators choose a real financial formula for the credit cuota', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();
    expect(screen.getByText(/Formula base de cuota/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sistema frances/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Interes simple/i }));

    const template = CREDIT_FORMULA_TEMPLATES.find((item) => item.key === 'simple_interest')!;
    await waitFor(() => {
      const container = useBlockEditorStore.getState().containers.find((item) => item.outputVar === 'calculationMethod');
      expect(container?.label).toBe(template.name);
      expect(container?.blocks[0]).toMatchObject({
        kind: 'expression',
        formula: template.formula,
        templateKey: template.key,
      });
    });
  });

  it('creates distinct tier rules instead of repeated default copies', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();

    const findInstallmentTarget = (label: string) => screen.getAllByRole('button').find((button) => (
      button.textContent?.includes('Cuota fija') && button.textContent?.includes(label)
    ));

    fireEvent.click(findInstallmentTarget('Crear excepcion')!);
    fireEvent.click(findInstallmentTarget('Agregar otra prioridad')!);

    const installmentContainer = useBlockEditorStore.getState().containers.find((item) => item.outputVar === 'installmentAmount');
    const rules = installmentContainer?.blocks.filter((block) => block.kind === 'if' || block.kind === 'elseIf') || [];
    expect(rules).toHaveLength(2);
    expect(rules[0].condition?.value).not.toBe(rules[1].condition?.value);
    expect(rules[0].thenValue).not.toBe(rules[1].thenValue);
  });

  it('blocks validation when edited rules become exact duplicates', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();
    act(() => {
      useBlockEditorStore.getState().setContainers([{
        id: 'container_installmentAmount',
        label: 'Cuota fija',
        outputVar: 'installmentAmount',
        blocks: [
          { id: 'rule_a', kind: 'if', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: '200000' },
          { id: 'rule_b', kind: 'elseIf', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: '200000' },
        ],
      }]);
    });

    await screen.findAllByText(/Si Monto del credito > 1000000/i);

    fireEvent.click(screen.getAllByRole('button', { name: /validar/i })[0]);

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Regla duplicada',
      }));
    });
    expect(mockCalculateGraph).not.toHaveBeenCalled();
  });

  it('renders logic block controls when tools are opened', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();
    const toolsButton = await screen.findByRole('button', { name: /datos disponibles/i });
    fireEvent.click(toolsButton);

    await waitFor(() => {
      expect(screen.getAllByText('Si').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Si no, cuando').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('En cualquier otro caso').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows live test panel after validating', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();
    const validateButton = (await screen.findAllByRole('button', { name: /validar/i }))[0];
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText(/Impacto real/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Cuota/i).length).toBeGreaterThan(0);
    });
  });

  it('calls saveGraph when save button is clicked', async () => {
    renderWithProviders(<FormulaEditorPage />);

    await waitForEditorReady();
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

    await waitForEditorReady();
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

    await waitForEditorReady();
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
