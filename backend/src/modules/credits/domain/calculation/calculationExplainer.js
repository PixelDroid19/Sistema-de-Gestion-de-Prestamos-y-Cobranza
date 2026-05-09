const METHOD_EXPLANATIONS = {
  FRENCH: {
    title: 'Sistema frances',
    formula: 'cuota = capital * tasaMensual * (1 + tasaMensual)^plazo / ((1 + tasaMensual)^plazo - 1)',
    description: 'Genera una cuota fija. Cada pago cubre primero interes del saldo vigente y el resto reduce capital.',
  },
  SIMPLE: {
    title: 'Interes simple',
    formula: 'interesTotal = capital * tasaAnual * (plazoMeses / 12); cuota = (capital + interesTotal) / plazo',
    description: 'Calcula interes sobre el capital inicial y lo reparte de forma uniforme entre las cuotas.',
  },
  COMPOUND: {
    title: 'Interes compuesto',
    formula: 'interesTotal = capital * ((1 + tasaMensual)^plazo - 1); cuota = (capital + interesTotal) / plazo',
    description: 'Calcula el costo acumulado por capitalizacion mensual y lo distribuye entre cuotas.',
  },
};

const LATE_FEE_EXPLANATIONS = {
  NONE: 'No se cobra mora.',
  SIMPLE: 'Mora simple: monto vencido * tasa anual de mora / 365 * dias vencidos.',
  COMPOUND: 'Mora compuesta: monto vencido * ((1 + tasa diaria)^dias - 1).',
  FLAT: 'Mora fija: valor fijo diario * dias vencidos.',
  TIERED: 'Mora por tramos: dias 1-30 a tasa base, 31-60 a 1.5x y 61+ a 2x.',
};

const buildCalculationExplanation = ({ method, input, profile, policySnapshot, summary, lateFeeMode }) => {
  const methodExplanation = METHOD_EXPLANATIONS[method] || METHOD_EXPLANATIONS.FRENCH;
  const annualRate = Number(input.interestRate || 0);

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
      monthlyInterestRate: annualRate / 100 / 12,
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
