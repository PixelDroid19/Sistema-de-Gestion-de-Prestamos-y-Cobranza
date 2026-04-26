// frontend/src/types/dag.ts

// =============================================================================
// ENUMS
// =============================================================================
export type NodeKind = 'formula' | 'output' | 'constant' | 'conditional' | 'lookup';
export type LateFeeMode = 'NONE' | 'SIMPLE' | 'COMPOUND' | 'FLAT' | 'TIERED';
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'annulled';
export type CalculationMethodKey = 'FRENCH' | 'SIMPLE' | 'COMPOUND';

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
  metadata?: DagGraphMetadata;
}

export interface FormulaExceptionRule {
  id: string;
  target: string;
  condition: {
    variable: string;
    operator: string;
    value: string;
  };
  value: string;
  priority: number;
}

export interface FormulaEditorModel {
  version: number;
  baseMethod: CalculationMethodKey;
  exceptionRules: FormulaExceptionRule[];
}

export interface DagGraphMetadata {
  editorModel?: FormulaEditorModel;
  [key: string]: unknown;
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
  isLocked?: boolean; // true when existing credits reference this exact formula version
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// CREDIT CALCULATION
// =============================================================================
export interface CreditCalculationInput {
  amount: number;
  interestRate: number;
  termMonths: number;
  startDate?: string;
  lateFeeMode?: LateFeeMode;
  annualLateFeeRate?: number;
  rateSource?: 'policy' | 'manual';
  lateFeeSource?: 'policy' | 'manual';
}

export type SimulationInput = CreditCalculationInput;

export interface NextInstallment {
  installmentNumber: number;
  dueDate: string;
  scheduledPayment: number;
  remainingPrincipal: number;
  remainingInterest: number;
}

export interface CreditCalculationSummary {
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

export type SimulationSummary = CreditCalculationSummary;

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

export interface CreditCalculationResult {
  lateFeeMode: LateFeeMode;
  calculationMethod?: CalculationMethodKey;
  policySnapshot?: Record<string, unknown> | null;
  summary: CreditCalculationSummary;
  schedule: AmortizationRow[];
  graphVersionId?: number | null;
}

export type SimulationResult = CreditCalculationResult;

export interface CreditCalculationResponse {
  success: boolean;
  message: string;
  data: {
    calculation: CreditCalculationResult;
    simulation?: CreditCalculationResult;
  };
}

export type SimulationResponse = CreditCalculationResponse;

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

export interface DagWorkbenchCalculationMethod {
  key: CalculationMethodKey;
  label: string;
  equation: string;
  description: string;
  useCase: string;
}

export interface DagWorkbenchScope {
  key: string;
  label: string;
  description: string;
  defaultName: string;
  requiredInputs: string[];
  requiredOutputs: string[];
  calculationInput?: CreditCalculationInput;
  simulationInput: CreditCalculationInput;
  calculationMethods?: DagWorkbenchCalculationMethod[];
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

export interface CalculateGraphRequest {
  scopeKey: string;
  calculationInput?: CreditCalculationInput | Record<string, any>;
  simulationInput?: CreditCalculationInput | Record<string, any>;
  graph: DagGraph;
}

export type SimulateGraphRequest = CalculateGraphRequest;

export interface CalculateGraphResponse {
  success: boolean;
  message: string;
  data: {
    graph?: DagGraphVersion;
    graphVersion?: DagGraphVersion;
    validation: ValidationResult;
    calculation: CreditCalculationResult;
    simulation?: CreditCalculationResult;
    summary: {
      latestGraph: DagGraphVersion;
      latestCalculation: DagCalculationSummary;
      latestSimulation?: DagCalculationSummary;
    };
  };
}

export type SimulateGraphResponse = CalculateGraphResponse;

export interface GraphSummaryResponse {
  success: boolean;
  data: {
    summary: {
      latestGraph: DagGraphVersion | null;
      latestCalculation?: DagCalculationSummary | null;
      latestSimulation: DagCalculationSummary | null;
    };
  };
}

// =============================================================================
// CALCULATION SUMMARY (for history)
// =============================================================================
export interface DagCalculationSummary {
  id: number;
  scopeKey: string;
  graphVersionId: number | null;
  createdByUserId: number;
  selectedSource: 'dag' | 'draft';
  fallbackReason: string | null;
  simulationInput: CreditCalculationInput;
  summary: CreditCalculationSummary;
  schedulePreview: AmortizationRow[];
  createdAt: string;
}

export type DagSimulationSummary = DagCalculationSummary;

// =============================================================================
// BLOCK AST TYPES (Visual Formula Editor)
// =============================================================================

/**
 * BlockKind represents the type of visual block in the formula editor.
 * These blocks compose vertically to form a formula definition.
 */
export type BlockKind = 'if' | 'elseIf' | 'else' | 'expression' | 'output' | 'container';

/**
 * Condition within an IF/ELSE-IF block.
 * Represents: variable operator value
 */
export interface BlockCondition {
  variable: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: string;
}

/**
 * A single visual block in the formula editor canvas.
 * Blocks are ordered in a linear array and compile to DagGraph nodes.
 */
export interface BlockDefinition {
  id: string;
  kind: BlockKind;
  /** For if/elseIf blocks: the condition to evaluate */
  condition?: BlockCondition;
  /** For if/elseIf blocks: the result value if condition is true */
  thenValue?: string;
  /** For else blocks: the fallback value */
  elseValue?: string;
  /** For output blocks: the variable name that receives the result */
  outputVar?: string;
  /** For expression blocks: a label or description */
  label?: string;
  /** For expression blocks: the executable formula saved into the DAG */
  formula?: string;
  /** Optional financial template key used to render operator-friendly labels */
  templateKey?: string;
  /** For container blocks: groups of child blocks */
  children?: BlockDefinition[];
}

/**
 * A formula container represents a named group of blocks that
 * together define one logical formula on the canvas.
 */
export interface FormulaContainer {
  id: string;
  label: string;
  blocks: BlockDefinition[];
  outputVar: string;
}

export interface GraphHistoryEntry {
  id: number;
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
  usage?: {
    count: number;
    references: Array<{
      graphId: number;
      graphName: string;
      version: number;
      status: string;
      usageCount: number;
      isActive: boolean;
      isLocked: boolean;
    }>;
    isReferencedByActiveGraph: boolean;
    isReferencedByLockedGraph: boolean;
    isReferencedByProtectedGraph: boolean;
  };
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
