const { getEquivalentMonthlyRate } = require('./amortizationMethods');

const METHOD_EXPLANATIONS = {
  FRENCH: {
    title: 'Sistema francés',
    formula: 'cuota = capital * tasaMensual * (1 + tasaMensual)^plazo / ((1 + tasaMensual)^plazo - 1)',
    description: 'Genera una cuota fija. Cada pago cubre primero interés del saldo vigente y el resto reduce capital.',
  },
  SIMPLE: {
    title: 'Interés simple',
    formula: 'interésTotal = capital * tasaAnual * (plazoMeses / 12); cuota = (capital + interésTotal) / plazo',
    description: 'Calcula interés sobre el capital inicial y lo reparte de forma uniforme entre las cuotas.',
  },
  COMPOUND: {
    title: 'Interés compuesto',
    formula: 'interésTotal = capital * ((1 + tasaMensual)^plazo - 1); cuota = (capital + interésTotal) / plazo',
    description: 'Calcula el costo acumulado por capitalización mensual y lo distribuye entre cuotas.',
  },
};

const LATE_FEE_EXPLANATIONS = {
  NONE: 'No se cobra mora.',
  SIMPLE: 'Mora simple: monto vencido * tasa anual de mora / 365 * días vencidos.',
  COMPOUND: 'Mora compuesta: monto vencido * ((1 + tasa diaria)^días - 1).',
  FLAT: 'Mora fija: valor fijo diario * días vencidos.',
  TIERED: 'Mora por tramos: días 1-30 a tasa base, 31-60 a 1.5x y 61+ a 2x.',
};

const buildCalculationExplanation = ({ method, input, profile, policySnapshot, summary, lateFeeMode }) => {
  const methodExplanation = METHOD_EXPLANATIONS[method] || METHOD_EXPLANATIONS.FRENCH;
  const annualRate = Number(input.interestRate || 0);
  const monthlyRate = getEquivalentMonthlyRate(annualRate);

  return {
    profile: {
      id: profile?.id ?? null,
      version: profile?.version ?? null,
      name: profile?.name ?? null,
      scopeKey: profile?.scopeKey ?? null,
    },
    method: {
      key: method,
      ...methodExplanation,
    },
    inputs: {
      amount: Number(input.amount),
      annualInterestRate: annualRate,
      monthlyInterestRate: monthlyRate,
      termMonths: Number(input.termMonths),
      startDate: input.startDate || null,
    },
    lateFee: {
      mode: lateFeeMode,
      description: LATE_FEE_EXPLANATIONS[lateFeeMode] || LATE_FEE_EXPLANATIONS.NONE,
      annualLateFeeRate: input.annualLateFeeRate ?? input.lateFeeRate ?? 0,
    },
    policySnapshot: policySnapshot || null,
    result: {
      installmentAmount: summary?.installmentAmount ?? null,
      totalInterest: summary?.totalInterest ?? null,
      totalPayable: summary?.totalPayable ?? null,
    },
  };
};

module.exports = {
  METHOD_EXPLANATIONS,
  LATE_FEE_EXPLANATIONS,
  buildCalculationExplanation,
};
