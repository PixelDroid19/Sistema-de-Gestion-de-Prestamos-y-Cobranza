const { ValidationError } = require('@/utils/errorHandler');

const SUPPORTED_CALCULATION_METHODS = [
  {
    key: 'FRENCH',
    label: 'Sistema frances',
    equation: 'C = P * r(1+r)^n / ((1+r)^n - 1)',
    description: 'Cuota fija con amortizacion sobre saldo.',
    useCase: 'Creditos con cuota fija y cronograma de amortizacion.',
  },
  {
    key: 'SIMPLE',
    label: 'Interes simple',
    equation: 'C = (P + P*r*t) / n',
    description: 'Interes calculado sobre el capital inicial y distribuido entre cuotas.',
    useCase: 'Creditos de corto plazo con lectura financiera simple.',
  },
  {
    key: 'COMPOUND',
    label: 'Interes compuesto',
    equation: 'C = P(1+r)^n / n',
    description: 'Costo compuesto por periodo y repartido en cuotas iguales.',
    useCase: 'Productos donde el costo financiero se acumula por periodo.',
  },
];

const SUPPORTED_METHOD_KEYS = new Set(SUPPORTED_CALCULATION_METHODS.map((method) => method.key));

const normalizeCalculationMethod = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'FRENCH';
  }

  const method = String(value).trim().replace(/^['"]|['"]$/g, '').toUpperCase();
  return method || 'FRENCH';
};

const assertSupportedCalculationMethod = (value) => {
  const method = normalizeCalculationMethod(value);
  if (!SUPPORTED_METHOD_KEYS.has(method)) {
    throw new ValidationError(`Metodo de calculo invalido: ${method}. Usa FRENCH, SIMPLE o COMPOUND.`);
  }

  return method;
};

module.exports = {
  SUPPORTED_CALCULATION_METHODS,
  SUPPORTED_METHOD_KEYS,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
};
