// frontend/src/types/dag.ts

// =============================================================================
// ENUMS
// =============================================================================
export type NodeKind = 'formula' | 'output' | 'constant' | 'conditional' | 'lookup';
export type LateFeeMode = 'SIMPLE' | 'FLAT' | 'TIERED';
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'annulled';

// =============================================================================
// CORE DAG TYPES
// =============================================================================
export interface DagNode {
  id: string;
  kind: NodeKind;
  label?: string;
  description?: string;
  dependencies?: string[];
  formula?: string;
  outputVar?: string;
  metadata?: Record<string, unknown>;
}

export interface DagEdge {
  source: string;
  target: string;
}

export interface DagGraph {
  nodes: DagNode[];
  edges: DagEdge[];
}

// =============================================================================
// VALIDATION
// =============================================================================
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  outputCount: number;
  formulaNodeCount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: GraphSummary;
}

// =============================================================================
// PERSISTENCE (DagGraphVersion)
// =============================================================================
export type DagGraphStatus = 'active' | 'inactive' | 'archived';
export interface DagGraphVersion {
  id: number;
  scopeKey: string;
  name: string;
  description?: string;
  version: number;
  status: DagGraphStatus;
  graph: DagGraph;
  graphSummary: GraphSummary;
  validation: ValidationResult;
  usageCount?: number; // computed via subquery — how many loans reference this graph
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SIMULATION
// =============================================================================
export interface SimulationInput {
  amount: number;
  interestRate: number;
  termMonths: number;
  startDate?: string;
  lateFeeMode?: LateFeeMode;
}

export interface NextInstallment {
  installmentNumber: number;
  dueDate: string;
  scheduledPayment: number;
  remainingPrincipal: number;
  remainingInterest: number;
}

export interface SimulationSummary {
  installmentAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  totalPayable: number;
  outstandingBalance: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingInstallments: number;
  nextInstallment: NextInstallment | null;
}

export interface AmortizationRow {
  installmentNumber: number;
  dueDate: string;
  openingBalance: number;
  scheduledPayment: number;
  principalComponent: number;
  interestComponent: number;
  paidPrincipal: number;
  paidInterest: number;
  paidTotal: number;
  remainingPrincipal: number;
  remainingInterest: number;
  remainingBalance: number;
  status: InstallmentStatus;
}

export interface SimulationResult {
  lateFeeMode: LateFeeMode;
  summary: SimulationSummary;
  schedule: AmortizationRow[];
}

export interface SimulationResponse {
  success: boolean;
  message: string;
  data: {
    simulation: SimulationResult;
  };
}

// =============================================================================
// WORKBENCH APIS
// =============================================================================
export interface LoadGraphResponse {
  success: boolean;
  data: {
    graph: DagGraphVersion;
    graphVersion?: DagGraphVersion;
  };
}

export interface SaveGraphRequest {
  scopeKey: string;
  name: string;
  graph: DagGraph;
}

export interface SaveGraphResponse {
  success: boolean;
  message: string;
  data: {
    graph: DagGraphVersion;
    graphVersion?: DagGraphVersion;
  };
}

export interface ValidateGraphRequest {
  scopeKey: string;
  graph: DagGraph;
}

export interface GraphListResponse {
  success: boolean;
  data: {
    graphs: DagGraphVersion[];
  };
}

export interface GraphDetailsResponse {
  success: boolean;
  data: {
    graph: DagGraphVersion;
  };
}

export interface GraphStatusUpdateResponse {
  success: boolean;
  message: string;
  data: {
    graph: DagGraphVersion;
  };
}

export interface GraphDeleteResponse {
  success: boolean;
  message: string;
}

export interface ValidateGraphResponse {
  success: boolean;
  data: {
    validation: ValidationResult;
  };
}

export interface SimulateGraphRequest {
  scopeKey: string;
  simulationInput: SimulationInput;
  graph: DagGraph;
}

export interface SimulateGraphResponse {
  success: boolean;
  message: string;
  data: {
    graphVersion: DagGraphVersion;
    validation: ValidationResult;
    simulation: SimulationResult;
    summary: {
      latestGraph: DagGraphVersion;
      latestSimulation: DagSimulationSummary;
    };
  };
}

export interface GraphSummaryResponse {
  success: boolean;
  data: {
    summary: {
      latestGraph: DagGraphVersion | null;
      latestSimulation: DagSimulationSummary | null;
    };
  };
}

// =============================================================================
// SIMULATION SUMMARY (for history)
// =============================================================================
export interface ParityResult {
  passed: boolean;
  tolerance: number;
  mismatches: Array<{
    scope: string;
    field: string;
    expected: unknown;
    actual: unknown;
  }>;
}

export interface DagSimulationSummary {
  id: number;
  scopeKey: string;
  graphVersionId: number | null;
  createdByUserId: number;
  selectedSource: 'legacy' | 'dag';
  fallbackReason: string | null;
  parity: ParityResult;
  simulationInput: SimulationInput;
  summary: SimulationSummary;
  schedulePreview: AmortizationRow[];
  createdAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DAG_NODE_WIDTH = 200;
export const DAG_NODE_HEIGHT = 80;
export const DAG_EDGE_WIDTH = 2;

export const DEFAULT_CANVAS_TRANSFORM = {
  x: 50,
  y: 50,
  scale: 1,
};

export const DEFAULT_GRAPH: DagGraph = {
  nodes: [],
  edges: [],
};

// Available scopes for the workbench
export const DAG_SCOPES = [
  { key: 'credit-simulation', label: 'Simulación de Crédito' },
  { key: 'payment-calculation', label: 'Cálculo de Pagos' },
  { key: 'late-fee-calculation', label: 'Cálculo de Mora' },
  { key: 'amortization', label: 'Amortización' },
] as const;

// Node kind labels and colors
export const NODE_KIND_CONFIG = {
  formula: { 
    color: 'bg-blue-500 dark:bg-blue-600', 
    label: 'Fórmula' 
  },
  output: { 
    color: 'bg-emerald-500 dark:bg-emerald-600', 
    label: 'Salida' 
  },
  constant: { 
    color: 'bg-amber-500 dark:bg-amber-600', 
    label: 'Constante' 
  },
  conditional: { 
    color: 'bg-purple-500 dark:bg-purple-600', 
    label: 'Condicional' 
  },
  lookup: { 
    color: 'bg-rose-500 dark:bg-rose-600', 
    label: 'Búsqueda' 
  },
} as const;

// Default formula helpers available in the backend
export const FORMULA_HELPERS = [
  { name: 'buildAmortizationSchedule', description: 'Genera tabla de amortización' },
  { name: 'summarizeSchedule', description: 'Resume la tabla en totales' },
  { name: 'assertSupportedLateFeeMode', description: 'Valida modo de mora' },
  { name: 'roundCurrency', description: 'Redondea a 2 decimales' },
] as const;
