const { ValidationError } = require('@/utils/errorHandler');

const SUPPORTED_CALCULATION_METHODS = [
  {
    key: 'FRENCH',
    label: 'Sistema francés',
    equation: 'C = P * r(1+r)^n / ((1+r)^n - 1)',
    description: 'Cuota fija con amortización sobre saldo.',
    useCase: 'Créditos con cuota fija y cronograma de amortización.',
  },
  {
    key: 'SIMPLE',
    label: 'Interés simple',
    equation: 'C = (P + P*r*t) / n',
    description: 'Interés calculado sobre el capital inicial y distribuido entre cuotas.',
    useCase: 'Créditos de corto plazo con lectura financiera simple.',
  },
  {
    key: 'COMPOUND',
    label: 'Interés compuesto',
    equation: 'C = P(1+r)^n / n',
    description: 'Costo compuesto por periodo y repartido en cuotas iguales.',
    useCase: 'Productos donde el costo financiero se acumula por periodo.',
  },
];

const SUPPORTED_METHOD_KEYS = new Set(SUPPORTED_CALCULATION_METHODS.map((method) => method.key));
const INVALID_CALCULATION_METHOD_MESSAGE = 'Selecciona un método de cálculo válido.';

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
    throw new ValidationError(INVALID_CALCULATION_METHOD_MESSAGE);
  }

  return method;
};

module.exports = {
  SUPPORTED_CALCULATION_METHODS,
  SUPPORTED_METHOD_KEYS,
  INVALID_CALCULATION_METHOD_MESSAGE,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
};
