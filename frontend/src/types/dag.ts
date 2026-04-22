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
  selectedSource: 'legacy' | 'dag' | 'draft';
  fallbackReason: string | null;
  parity: ParityResult;
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

export type VariableType = 'integer' | 'currency' | 'boolean' | 'float';
export type VariableSource = 'bureau_api' | 'app_data' | 'system_core';
export type VariableStatus = 'active' | 'idle' | 'deprecated';

export interface DagVariable {
  id: number;
  name: string;
  type: VariableType;
  source: VariableSource;
  description: string;
  status: VariableStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GraphHistoryEntry {
  version: number;
  commitMessage: string | null;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface GraphDiffEntry {
  previousGraph: DagGraph;
  newGraph: DagGraph;
  impactedVariables: string[];
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

export interface DagVariableListResponse {
  success: boolean;
  data: {
    variables: DagVariable[];
  };
}

export interface DagVariableCreateRequest {
  name: string;
  type: VariableType;
  source: VariableSource;
  description?: string;
}

export interface DagVariableCreateResponse {
  success: boolean;
  data: {
    variable: DagVariable;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SCOPE_LABELS: Record<string, string> = {
  'credit-simulation': 'Credito',
};

export const getScopeLabel = (scopeKey: string): string => SCOPE_LABELS[scopeKey] || scopeKey;

// Default formula helpers available in the backend
export const FORMULA_HELPERS = [
  {
    name: 'buildAmortizationSchedule',
    description: 'Genera tabla de amortización',
    template: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)',
  },
  {
    name: 'summarizeSchedule',
    description: 'Resume la tabla en totales',
    template: 'summarizeSchedule(schedule)',
  },
  {
    name: 'assertSupportedLateFeeMode',
    description: 'Valida modo de mora',
    template: 'assertSupportedLateFeeMode(lateFeeMode)',
  },
  {
    name: 'roundCurrency',
    description: 'Redondea a 2 decimales',
    template: 'roundCurrency(value)',
  },
  {
    name: 'calculateLateFee',
    description: 'Calcula mora: SIMPLE/FLAT/TIERED',
    template: 'calculateLateFee()',
  },
  {
    name: 'buildSimulationResult',
    description: 'Construye resultado (lateFeeMode, schedule, summary)',
    template: 'buildSimulationResult(lateFeeMode, schedule, summary)',
  },
] as const;
