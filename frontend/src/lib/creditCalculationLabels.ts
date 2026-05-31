import type { CalculationMethodKey, LateFeeMode } from '../types/creditCalculation';
import { tTerm, type TermKey } from '../i18n/terminology';

const CALCULATION_METHOD_LABEL_KEYS: Record<CalculationMethodKey, TermKey> = {
  FRENCH: 'creditCalculation.value.method.french',
  SIMPLE: 'creditCalculation.value.method.simple',
  COMPOUND: 'creditCalculation.value.method.compound',
};

const LATE_FEE_MODE_LABEL_KEYS: Record<LateFeeMode, TermKey> = {
  NONE: 'creditCalculation.value.lateFee.none',
  SIMPLE: 'creditCalculation.value.lateFee.simple',
  COMPOUND: 'creditCalculation.value.lateFee.compound',
  FLAT: 'creditCalculation.value.lateFee.flat',
  TIERED: 'creditCalculation.value.lateFee.tiered',
};

export const getCalculationValueLabel = (value: string | undefined, outputVar?: string): string => {
  if (!value) return tTerm('creditCalculation.value.undefined');

  if (outputVar === 'method') {
    return tTerm(CALCULATION_METHOD_LABEL_KEYS[value as CalculationMethodKey] ?? 'creditCalculation.value.method.unknown');
  }

  if (outputVar === 'lateFeeMode') {
    return tTerm(LATE_FEE_MODE_LABEL_KEYS[value as LateFeeMode] ?? 'creditCalculation.value.lateFee.unknown');
  }

  return tTerm('creditCalculation.value.unknown');
};
