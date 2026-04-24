import type { BlockDefinition } from '../types/dag';

export const FRENCH_INSTALLMENT_FORMULA =
  'monthlyRate == 0 ? round(amount / termMonths, 2) : round(amount * monthlyRate * pow(1 + monthlyRate, termMonths) / (pow(1 + monthlyRate, termMonths) - 1), 2)';

export interface CreditFormulaTemplate {
  key: string;
  name: string;
  shortName: string;
  badge?: string;
  outputVar: 'calculationMethod';
  formula: string;
  legacyInstallmentFormula?: string;
  equation: string;
  description: string;
  useCase: string;
  variables: Array<{ symbol: string; label: string }>;
}

export const CREDIT_FORMULA_TEMPLATES: CreditFormulaTemplate[] = [
  {
    key: 'french_installment',
    name: 'Sistema frances',
    shortName: 'Cuota fija',
    badge: 'Recomendado',
    outputVar: 'calculationMethod',
    formula: "'FRENCH'",
    legacyInstallmentFormula: FRENCH_INSTALLMENT_FORMULA,
    equation: 'C = P * r(1+r)^n / ((1+r)^n - 1)',
    description: 'Calcula una cuota fija con amortizacion e interes sobre saldo. Es la base para creditos personales y operacion recurrente.',
    useCase: 'Creditos con cuota fija y cronograma de amortizacion.',
    variables: [
      { symbol: 'C', label: 'cuota que pagara el cliente' },
      { symbol: 'P', label: 'monto del credito' },
      { symbol: 'r', label: 'tasa mensual equivalente' },
      { symbol: 'n', label: 'numero de cuotas' },
    ],
  },
  {
    key: 'simple_interest',
    name: 'Interes simple',
    shortName: 'Microcredito corto',
    outputVar: 'calculationMethod',
    formula: "'SIMPLE'",
    legacyInstallmentFormula: 'round((amount + (amount * (interestRate / 100) * (termMonths / 12))) / termMonths, 2)',
    equation: 'C = (P + P*r*t) / n',
    description: 'Calcula interes solo sobre el capital inicial y divide el total entre las cuotas.',
    useCase: 'Creditos muy cortos o microcreditos basicos.',
    variables: [
      { symbol: 'C', label: 'cuota que pagara el cliente' },
      { symbol: 'P', label: 'capital inicial' },
      { symbol: 'r', label: 'tasa anual aplicada' },
      { symbol: 't', label: 'tiempo en anos' },
      { symbol: 'n', label: 'numero de cuotas' },
    ],
  },
  {
    key: 'compound_interest',
    name: 'Interes compuesto',
    shortName: 'Digital moderno',
    outputVar: 'calculationMethod',
    formula: "'COMPOUND'",
    legacyInstallmentFormula: 'round((amount * pow(1 + (interestRate / 100 / 12), termMonths)) / termMonths, 2)',
    equation: 'C = P(1+r)^n / n',
    description: 'Acumula intereses sobre intereses y distribuye el total en cuotas iguales.',
    useCase: 'Productos digitales donde el costo crece por periodo compuesto.',
    variables: [
      { symbol: 'C', label: 'cuota que pagara el cliente' },
      { symbol: 'P', label: 'capital inicial' },
      { symbol: 'r', label: 'tasa mensual equivalente' },
      { symbol: 'n', label: 'numero de cuotas' },
    ],
  },
];

export const CREDIT_FORMULA_REFERENCE = [
  {
    name: 'TEA',
    equation: 'TEA = (1+r)^m - 1',
    description: 'Convierte una tasa por periodo en una tasa anual real.',
  },
  {
    name: 'Valor presente',
    equation: 'VP = VF / (1+r)^t',
    description: 'Sirve para evaluar cuanto vale hoy un flujo futuro.',
  },
  {
    name: 'Costo total del credito',
    equation: 'Total = Capital + Intereses + Comisiones',
    description: 'El sistema lo reporta automaticamente al validar y crear el credito.',
  },
  {
    name: 'Score / default',
    equation: 'Score = w1X1 + ... + wnXn',
    description: 'Requiere variables de riesgo adicionales antes de afectar aprobacion.',
  },
];

const normalizeFormula = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function findCreditFormulaTemplate(formula?: string, templateKey?: string): CreditFormulaTemplate | null {
  if (templateKey) {
    const byKey = CREDIT_FORMULA_TEMPLATES.find((template) => template.key === templateKey);
    if (byKey) return byKey;
  }

  const normalized = normalizeFormula(formula || '');
  if (!normalized) return null;

  return CREDIT_FORMULA_TEMPLATES.find((template) => (
    normalizeFormula(template.formula) === normalized
    || normalizeFormula(template.legacyInstallmentFormula || '') === normalized
  )) || null;
}

export function getFormulaFromBlock(block: BlockDefinition): string {
  return String(block.formula || block.label || '').trim();
}
