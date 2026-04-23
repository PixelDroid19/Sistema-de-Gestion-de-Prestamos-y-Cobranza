// frontend/src/types/dag.ts

// =============================================================================
// ENUMS
// =============================================================================
export type NodeKind = 'formula' | 'output' | 'constant' | 'conditional' | 'lookup';
export type LateFeeMode = 'NONE' | 'SIMPLE' | 'COMPOUND' | 'FLAT' | 'TIERED';
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
  x?: number;
  y?: number;
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
  graphVersionId?: number | null;
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

export interface DagWorkbenchScopeHelper {
  name: string;
  label: string;
  description: string;
}

export interface DagWorkbenchScope {
  key: string;
  label: string;
  description: string;
  defaultName: string;
  requiredInputs: string[];
  requiredOutputs: string[];
  simulationInput: SimulationInput;
  helpers: DagWorkbenchScopeHelper[];
  defaultGraph: DagGraph;
}

export interface DagWorkbenchScopesResponse {
  success: boolean;
  data: {
    scopes: DagWorkbenchScope[];
  };
}

export interface ValidateGraphResponse {
  success: boolean;
  data: {
    validation: ValidationResult;
  };
}

export interface SimulateGraphRequest {
  scopeKey: string;
  simulationInput: SimulationInput | Record<string, any>;
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
export interface DagSimulationSummary {
  id: number;
  scopeKey: string;
  graphVersionId: number | null;
  createdByUserId: number;
  selectedSource: 'dag' | 'draft';
  fallbackReason: string | null;
  simulationInput: SimulationInput;
  summary: SimulationSummary;
  schedulePreview: AmortizationRow[];
  createdAt: string;
}

// =============================================================================
// BLOCK AST TYPES (Visual Formula Editor)
// =============================================================================

export type BlockNodeType = 'variable' | 'value' | 'operator' | 'if' | 'and' | 'or' | 'output';

export interface BlockNode {
  id: string;
  type: BlockNodeType;
  variableName?: string;
  value?: number | string | boolean;
  operator?: '+' | '-' | '*' | '/' | '>' | '<' | '>=' | '<=' | '=';
  left?: BlockNode;
  right?: BlockNode;
  condition?: BlockNode;
  thenBlock?: BlockNode;
  elseBlock?: BlockNode;
  blocks?: BlockNode[];
  outputVar?: string;
  expression?: BlockNode;
}

export interface GraphHistoryEntry {
  version: number;
  commitMessage: string | null;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  isActive: boolean;
}

export type VariableType = 'integer' | 'currency' | 'boolean' | 'percent';
export type VariableSource = 'bureau_api' | 'app_data' | 'system_core';
export type VariableStatus = 'active' | 'idle' | 'deprecated';

export interface DagVariable {
  id: number;
  name: string;
  type: VariableType;
  source: VariableSource;
  value: string | null;
  status: VariableStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariableListResponse {
  success: boolean;
  count: number;
  data: {
    variables: DagVariable[];
    pagination?: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  };
}

export interface NodeDelta {
  nodeId: string;
  change: 'added' | 'removed' | 'modified' | 'unchanged';
  oldFormula?: string;
  newFormula?: string;
  oldOutputVar?: string;
  newOutputVar?: string;
}

export interface GraphDiffEntry {
  previousGraph: DagGraph;
  newGraph: DagGraph;
  impactedVariables: string[];
  deltas: NodeDelta[];
}

export interface GraphDiffResponse {
  success: boolean;
  data: {
    diff: GraphDiffEntry;
  };
}

export interface GraphHistoryResponse {
  success: boolean;
  data: {
    history: GraphHistoryEntry[];
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SCOPE_LABELS: Record<string, string> = {
  'credit-simulation': 'Credito',
};

export const getScopeLabel = (scopeKey: string): string => SCOPE_LABELS[scopeKey] || scopeKey;

// Helpers are loaded dynamically from the backend via dagService.listScopes()
// Do NOT hardcode helper definitions here — the backend scopeRegistry is the single source of truth.
