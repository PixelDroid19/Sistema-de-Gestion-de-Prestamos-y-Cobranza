const WORKBENCH_SCOPE_DEFINITIONS = [
  {
    key: 'credit-simulation',
    label: 'Simulacion de credito',
    description: 'Formula editable para originacion, amortizacion y resumen financiero del credito.',
    defaultName: 'Formula base de simulacion de credito',
    simulationInput: {
      amount: 2000000,
      interestRate: 60,
      termMonths: 12,
      lateFeeMode: 'SIMPLE',
    },
    helpers: [
      { name: 'buildAmortizationSchedule', description: 'Genera el cronograma canonico del credito.' },
      { name: 'summarizeSchedule', description: 'Resume el cronograma en totales y saldo pendiente.' },
      { name: 'assertSupportedLateFeeMode', description: 'Valida el modo de mora configurado.' },
      { name: 'calculateLateFee', description: 'Calcula mora para escenarios vencidos.' },
      { name: 'roundCurrency', description: 'Redondea resultados monetarios a 2 decimales.' },
    ],
    defaultGraph: {
      nodes: [
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
          id: 'input_late_fee_mode',
          kind: 'conditional',
          label: 'Modo de mora',
          description: 'Valida el modo de mora antes de calcular el cronograma.',
          formula: 'assertSupportedLateFeeMode(lateFeeMode)',
          outputVar: 'lateFeeMode',
        },
        {
          id: 'amortization_schedule',
          kind: 'formula',
          label: 'Cronograma canonico',
          description: 'Usa el helper del dominio para generar la tabla de amortizacion.',
          formula: 'buildAmortizationSchedule({ amount, interestRate, termMonths, startDate, lateFeeMode })',
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
        {
          id: 'simulation_result',
          kind: 'output',
          label: 'Resultado final',
          description: 'Expone el resultado usado por el simulador y por la originacion.',
          formula: '{ lateFeeMode: lateFeeMode, schedule: schedule, summary: summary }',
          outputVar: 'result',
        },
      ],
      edges: [
        { source: 'input_amount', target: 'amortization_schedule' },
        { source: 'input_rate', target: 'amortization_schedule' },
        { source: 'input_term', target: 'amortization_schedule' },
        { source: 'input_late_fee_mode', target: 'amortization_schedule' },
        { source: 'amortization_schedule', target: 'financial_summary' },
        { source: 'input_late_fee_mode', target: 'simulation_result' },
        { source: 'amortization_schedule', target: 'simulation_result' },
        { source: 'financial_summary', target: 'simulation_result' },
      ],
    },
  },
];

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
  simulationInput: scope.simulationInput,
  helpers: scope.helpers,
  defaultGraph: scope.defaultGraph,
}));

module.exports = {
  DEFAULT_SCOPE_KEY,
  normalizeScopeKey,
  getDagWorkbenchScopeDefinition,
  listDagWorkbenchScopes,
};
