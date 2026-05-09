import type { CalculationMethodKey, LateFeeMode } from '../types/creditCalculation';

const CALCULATION_METHOD_LABELS: Record<CalculationMethodKey, string> = {
  FRENCH: 'Francés',
  SIMPLE: 'Interés simple',
  COMPOUND: 'Interés compuesto',
};

const LATE_FEE_MODE_LABELS: Record<LateFeeMode, string> = {
  NONE: 'Sin mora',
  SIMPLE: 'Mora simple',
  COMPOUND: 'Mora compuesta',
  FLAT: 'Mora plana',
  TIERED: 'Mora por tramos',
};

export const getCalculationValueLabel = (value: string | undefined, outputVar?: string): string => {
  if (!value) return 'No definido';

  if (outputVar === 'method') {
    return CALCULATION_METHOD_LABELS[value as CalculationMethodKey] || value;
  }

  if (outputVar === 'lateFeeMode') {
    return LATE_FEE_MODE_LABELS[value as LateFeeMode] || value;
  }

  return value;
};
