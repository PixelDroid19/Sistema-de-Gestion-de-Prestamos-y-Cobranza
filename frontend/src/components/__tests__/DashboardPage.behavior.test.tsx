import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardPage from '../DashboardPage';

const mockNavigate = vi.fn();
const mockListGraphs = vi.fn();
const mockUpdateGraphStatus = vi.fn();
const mockDeleteGraph = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/dagService', () => ({
  default: {
    listGraphs: (scopeKey: string) => mockListGraphs(scopeKey),
    updateGraphStatus: (graphId: number, status: string) => mockUpdateGraphStatus(graphId, status),
    deleteGraph: (graphId: number) => mockDeleteGraph(graphId),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleGraphs = [
  {
    id: 1,
    scopeKey: 'credit-simulation',
    name: 'Formula A',
    description: 'Desc A',
    version: 3,
    status: 'active',
    graph: { nodes: [], edges: [] },
    graphSummary: { nodeCount: 4, edgeCount: 3, outputCount: 1, formulaNodeCount: 2 },
    validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 4, edgeCount: 3, outputCount: 1, formulaNodeCount: 2 } },
    createdByUserId: 1,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-21T10:00:00Z',
  },
  {
    id: 2,
    scopeKey: 'credit-simulation',
    name: 'Formula B',
    description: 'Desc B',
    version: 2,
    status: 'inactive',
    graph: { nodes: [], edges: [] },
    graphSummary: { nodeCount: 3, edgeCount: 2, outputCount: 1, formulaNodeCount: 1 },
    validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 3, edgeCount: 2, outputCount: 1, formulaNodeCount: 1 } },
    createdByUserId: 1,
    createdAt: '2026-04-19T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  },
  {
    id: 3,
    scopeKey: 'credit-simulation',
    name: 'Formula C',
    description: 'Desc C',
    version: 1,
    status: 'inactive',
    graph: { nodes: [], edges: [] },
    graphSummary: { nodeCount: 2, edgeCount: 1, outputCount: 1, formulaNodeCount: 1 },
    validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 2, edgeCount: 1, outputCount: 1, formulaNodeCount: 1 } },
    createdByUserId: 1,
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-19T10:00:00Z',
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListGraphs.mockResolvedValue({
      success: true,
      data: { graphs: sampleGraphs },
    });
    mockUpdateGraphStatus.mockResolvedValue({ success: true });
    mockDeleteGraph.mockResolvedValue({ success: true });
  });

  it('renders stats cards and table with current data', async () => {
    renderWithProviders(<DashboardPage />);

    // Wait for the async query to resolve and data to appear
    await waitFor(() => {
      expect(screen.getAllByText('Formula A').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });

    // Stats values: total=3, active version v3, drafts=2
    const statValues = screen.getAllByText('3');
    expect(statValues.length).toBeGreaterThanOrEqual(1);

    const versionValues = screen.getAllByText('v3');
    expect(versionValues.length).toBeGreaterThanOrEqual(1);

    const draftValues = screen.getAllByText('2');
    expect(draftValues.length).toBeGreaterThanOrEqual(1);

    // Table should list formulas
    expect(screen.getAllByText('Formula B').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Formula C').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to editor when Edit is clicked', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Formula A').length).toBeGreaterThanOrEqual(1);
    });

    const editButtons = screen.getAllByTitle('Editar');
    expect(editButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/formulas/1');
    });
  });
});
