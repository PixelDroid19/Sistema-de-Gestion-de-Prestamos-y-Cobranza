/**
 * Scope Registry — defines the contract every DAG graph for a given scope must
 * satisfy. Each scope declares:
 *
 *  - requiredInputs:  variables the caller must provide (contractVars)
 *  - requiredOutputs: variables the result object must contain
 *  - helpers:         domain functions injected into the evaluation scope
 *  - simulationInput: default values used by the workbench "simulate" button
 *  - defaultGraph:    the canonical graph seeded into DagGraphVersion on first boot
 *
 * Both `graphExecutor` and `workbenchService` read these contracts to validate
 * execution inputs and graph outputs before running.
 */

// ─── Scope definitions ───────────────────────────────────────────────────────

const WORKBENCH_SCOPE_DEFINITIONS = [
  {
    key: 'credit-simulation',
    label: 'Credito',
    description: 'Formula editable para originacion, amortizacion y resumen financiero del credito.',
    defaultName: 'Formula base de credito v2',

    // Contract: what the caller MUST provide
    requiredInputs: ['amount', 'interestRate', 'termMonths'],

    // Contract: what the graph's `result` output MUST contain
    requiredOutputs: ['lateFeeMode', 'schedule', 'summary'],

    // Default simulation input for the workbench preview button
    simulationInput: {
      amount: 2000000,
      interestRate: 60,
      termMonths: 12,
      lateFeeMode: 'SIMPLE',
      startDate: new Date().toISOString(),
    },

    // Helpers injected into the formula scope (scopeBuilder.js provides the real fns)
    // label = human-friendly name shown in the UI (never expose raw function names to users)
    // NOTE: Domain helpers (buildAmortizationSchedule, summarizeSchedule) are kept for
    // backward compatibility but are NOT exposed in the workbench toolbox. They are
    // rendered as opaque domain blocks in the UI, not as editable formulas.
    helpers: [
      { name: 'buildAmortizationSchedule', label: 'Generar tabla de amortización', description: 'Genera el cronograma canonico del credito.' },
      { name: 'summarizeSchedule', label: 'Resumen de cronograma', description: 'Resume el cronograma en totales y saldo pendiente.' },
      { name: 'buildSimulationResult', label: 'Construir resultado final', description: 'Construye el objeto resultado (lateFeeMode, schedule, summary).' },
    ],

    // Canonical default graph — seeded into DagGraphVersion on first boot
    // Mathematical formulas are decomposed into visible nodes. Domain blocks
    // (schedule generation, summary) remain as opaque helpers because they
    // require iteration and date arithmetic that mathjs cannot express.
    defaultGraph: {
      nodes: [
        // ── Inputs ────────────────────────────────────────────────────────────
        {
          id: 'input_amount',
          kind: 'constant',
          label: 'Monto del credito',
          description: 'Capital solicitado por el cliente.',
          outputVar: 'amount',
        },
        {
          id: 'input_rate',
          kind: 'constant',
          label: 'Tasa nominal',
          description: 'Tasa anual del producto.',
          outputVar: 'interestRate',
        },
        {
          id: 'input_term',
          kind: 'constant',
          label: 'Plazo',
          description: 'Cantidad de cuotas del credito.',
          outputVar: 'termMonths',
        },
        {
          id: 'input_startDate',
          kind: 'constant',
          label: 'Fecha inicio',
          description: 'Fecha de inicio del credito.',
          outputVar: 'startDate',
        },
        {
          id: 'input_lateFeeMode',
          kind: 'constant',
          label: 'Modo de mora',
          description: 'Modo de calculo de mora (SIMPLE, COMPOUND, FLAT, TIERED).',
          outputVar: 'lateFeeMode',
        },

        // ── Mathematical formulas (visible in the workbench) ──────────────────
        {
          id: 'monthly_rate',
          kind: 'formula',
          label: 'Tasa mensual',
          description: 'Convierte la tasa nominal anual a tasa mensual.',
          formula: 'interestRate / 100 / 12',
          outputVar: 'monthlyRate',
        },
        {
          id: 'installment_amount',
          kind: 'formula',
          label: 'Cuota mensual',
          description: 'Cuota fija del sistema frances (reducing balance).',
          formula: 'ifThenElse(monthlyRate == 0, round(amount / termMonths, 2), round(amount * monthlyRate * pow(1 + monthlyRate, termMonths) / (pow(1 + monthlyRate, termMonths) - 1), 2))',
          outputVar: 'installmentAmount',
        },
        {
          id: 'total_payable',
          kind: 'formula',
          label: 'Total a pagar',
          description: 'Monto total a pagar por el cliente.',
          formula: 'round(installmentAmount * termMonths, 2)',
          outputVar: 'totalPayable',
        },
        {
          id: 'total_interest',
          kind: 'formula',
          label: 'Total intereses',
          description: 'Suma total de intereses del credito.',
          formula: 'round(totalPayable - amount, 2)',
          outputVar: 'totalInterest',
        },

        // ── Domain blocks (opaque — rendered as blocks, not formulas) ─────────
        {
          id: 'amortization_schedule',
          kind: 'formula',
          label: 'Cronograma canonico',
          description: 'Genera la tabla de amortizacion mes a mes.',
          formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)',
          outputVar: 'schedule',
        },
        {
          id: 'financial_summary',
          kind: 'formula',
          label: 'Resumen financiero',
          description: 'Resume capital, interes, cuota y saldo del cronograma.',
          formula: 'summarizeSchedule(schedule)',
          outputVar: 'summary',
        },

        // ── Output ────────────────────────────────────────────────────────────
        {
          id: 'simulation_result',
          kind: 'output',
          label: 'Resultado final',
          description: 'Expone el resultado usado por el simulador y por la originacion.',
          formula: 'buildSimulationResult(lateFeeMode, schedule, summary)',
          outputVar: 'result',
        },
      ],
      edges: [
        // Inputs → monthly_rate
        { source: 'input_rate', target: 'monthly_rate' },

        // Inputs + monthly_rate → installment_amount
        { source: 'input_amount', target: 'installment_amount' },
        { source: 'input_term', target: 'installment_amount' },
        { source: 'monthly_rate', target: 'installment_amount' },

        // installment_amount + term → totals
        { source: 'installment_amount', target: 'total_payable' },
        { source: 'input_term', target: 'total_payable' },
        { source: 'total_payable', target: 'total_interest' },
        { source: 'input_amount', target: 'total_interest' },

        // Inputs → schedule (domain block)
        { source: 'input_amount', target: 'amortization_schedule' },
        { source: 'input_rate', target: 'amortization_schedule' },
        { source: 'input_term', target: 'amortization_schedule' },
        { source: 'input_startDate', target: 'amortization_schedule' },
        { source: 'input_lateFeeMode', target: 'amortization_schedule' },

        // schedule → summary (domain block)
        { source: 'amortization_schedule', target: 'financial_summary' },

        // Assemble result
        { source: 'input_lateFeeMode', target: 'simulation_result' },
        { source: 'amortization_schedule', target: 'simulation_result' },
        { source: 'financial_summary', target: 'simulation_result' },
      ],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_SCOPE_KEY = WORKBENCH_SCOPE_DEFINITIONS[0].key;

const normalizeScopeKey = (value) => String(value || '').trim().toLowerCase();

const getDagWorkbenchScopeDefinition = (scopeKey) => {
  const normalizedScopeKey = normalizeScopeKey(scopeKey);
  return WORKBENCH_SCOPE_DEFINITIONS.find((scope) => scope.key === normalizedScopeKey) || null;
};

const listDagWorkbenchScopes = () => WORKBENCH_SCOPE_DEFINITIONS.map((scope) => ({
  key: scope.key,
  label: scope.label,
  description: scope.description,
  defaultName: scope.defaultName,
  requiredInputs: scope.requiredInputs,
  requiredOutputs: scope.requiredOutputs,
  simulationInput: scope.simulationInput,
  helpers: scope.helpers,
  defaultGraph: scope.defaultGraph,
}));

// ─── Contract Validation ─────────────────────────────────────────────────────

/**
 * Validate that contractVars include every required input for the scope.
 * Returns an array of missing field names (empty = valid).
 */
const validateContractInputs = (scopeKey, contractVars = {}) => {
  const scope = getDagWorkbenchScopeDefinition(scopeKey);
  if (!scope || !Array.isArray(scope.requiredInputs)) return [];
  return scope.requiredInputs.filter((key) => contractVars[key] === undefined || contractVars[key] === null);
};

/**
 * Validate that a graph execution result contains every required output.
 * `resultObj` is the value bound to the `result` outputVar after execution.
 * Returns an array of missing field names (empty = valid).
 */
const validateContractOutputs = (scopeKey, resultObj = {}) => {
  const scope = getDagWorkbenchScopeDefinition(scopeKey);
  if (!scope || !Array.isArray(scope.requiredOutputs)) return [];
  return scope.requiredOutputs.filter((key) => resultObj[key] === undefined);
};

module.exports = {
  DEFAULT_SCOPE_KEY,
  normalizeScopeKey,
  getDagWorkbenchScopeDefinition,
  listDagWorkbenchScopes,
  validateContractInputs,
  validateContractOutputs,
};
