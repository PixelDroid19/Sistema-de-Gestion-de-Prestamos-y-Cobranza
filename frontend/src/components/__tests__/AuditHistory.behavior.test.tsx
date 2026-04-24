import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuditHistoryPage from '../AuditHistoryPage';

const mockGetGraphHistory = vi.fn();
const mockGetGraphDiff = vi.fn();
const mockRestoreGraph = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('../../services/dagService', () => ({
  default: {
    getGraphHistory: (graphId: number) => mockGetGraphHistory(graphId),
    getGraphDiff: (graphId: number, params: { compareToGraphId?: number; compareToVersionId?: number }) => mockGetGraphDiff(graphId, params),
    restoreGraph: (graphId: number, message?: string) => mockRestoreGraph(graphId, message),
  },
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: (opts: any) => mockToastSuccess(opts),
    error: (opts: any) => mockToastError(opts),
    warning: vi.fn(),
    info: vi.fn(),
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

function renderWithProviders(ui: React.ReactElement, { route = '/audit/1' } = {}) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/audit/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockHistory = [
  {
    id: 3,
    version: 3,
    commitMessage: 'Added late fee calculation',
    authorName: 'Admin User',
    authorEmail: 'admin@example.com',
    createdAt: '2026-04-21T10:00:00Z',
    isActive: true,
  },
  {
    id: 2,
    version: 2,
    commitMessage: 'Updated interest formula',
    authorName: 'Admin User',
    authorEmail: 'admin@example.com',
    createdAt: '2026-04-20T10:00:00Z',
    isActive: false,
  },
  {
    id: 1,
    version: 1,
    commitMessage: 'Initial version',
    authorName: 'Admin User',
    authorEmail: 'admin@example.com',
    createdAt: '2026-04-19T10:00:00Z',
    isActive: false,
  },
];

const mockDiff = {
  previousGraph: {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'oldFormula()', outputVar: 'x' },
    ],
    edges: [],
  },
  newGraph: {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'newFormula()', outputVar: 'x' },
      { id: 'n2', kind: 'constant', outputVar: 'y' },
    ],
    edges: [],
  },
  impactedVariables: ['x', 'y'],
  deltas: [
    {
      nodeId: 'n1',
      change: 'modified',
      oldFormula: 'oldFormula()',
      newFormula: 'newFormula()',
      oldOutputVar: 'x',
      newOutputVar: 'x',
    },
    {
      nodeId: 'n2',
      change: 'added',
      newFormula: '',
      newOutputVar: 'y',
    },
  ],
};

describe('AuditHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGraphHistory.mockResolvedValue({
      success: true,
      data: { history: mockHistory },
    });
    mockGetGraphDiff.mockResolvedValue({
      success: true,
      data: { diff: mockDiff },
    });
    mockRestoreGraph.mockResolvedValue({
      success: true,
      data: { graph: { id: 1, version: 4 } },
    });
  });

  it('creates a new draft version when Restore is clicked', async () => {
    renderWithProviders(<AuditHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument();
    });

    // Select version 2
    fireEvent.click(screen.getByText('v2'));

    await waitFor(() => {
      expect(screen.getByText('Restore')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(mockRestoreGraph).toHaveBeenCalledTimes(1);
      expect(mockRestoreGraph).toHaveBeenCalledWith(1, 'Restored from v2');
    });
  });

  it('displays side-by-side diff with +/- indicators when older version selected', async () => {
    renderWithProviders(<AuditHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument();
    });

    // Select version 2 (which has previous version 1)
    fireEvent.click(screen.getByText('v2'));

    await waitFor(() => {
      // Diff should load and show deltas
      expect(screen.getByText('Changes')).toBeInTheDocument();
    });

    // Assert that added/modified/removed lines render
    expect(screen.getByText('modified')).toBeInTheDocument();
    expect(screen.getByText('added')).toBeInTheDocument();

    // Check +/- content from DeltaLine component (use getAllByText because raw JSON side-by-side also contains these strings)
    expect(screen.getAllByText(/oldFormula/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/newFormula/i).length).toBeGreaterThanOrEqual(1);

    // Impacted variables chips
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('y')).toBeInTheDocument();
  });
});
