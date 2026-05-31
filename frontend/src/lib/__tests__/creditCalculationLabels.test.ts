import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { getCalculationValueLabel } from '../creditCalculationLabels';

describe('credit calculation labels', () => {
  beforeEach(() => {
    localStorage.removeItem('app.locale');
  });

  it('renders supported calculation values with operational labels', () => {
    expect(getCalculationValueLabel('FRENCH', 'method')).toBe('Francés');
    expect(getCalculationValueLabel('COMPOUND', 'lateFeeMode')).toBe('Mora compuesta');
  });

  it('uses the active locale for supported calculation values', () => {
    localStorage.setItem('app.locale', 'en');

    expect(getCalculationValueLabel('FRENCH', 'method')).toBe('French');
    expect(getCalculationValueLabel('COMPOUND', 'lateFeeMode')).toBe('Compound late fee');
  });

  it('does not expose unsupported calculation enum values', () => {
    expect(getCalculationValueLabel('BALLOON_INTERNAL', 'method')).toBe('Método no clasificado');
    expect(getCalculationValueLabel('INTERNAL_TIER', 'lateFeeMode')).toBe('Mora no clasificada');
    expect(getCalculationValueLabel('RAW_BACKEND_KEY')).toBe('Valor no clasificado');
  });

  it('keeps visible calculation labels in terminology dictionaries', () => {
    const source = readFileSync(`${process.cwd()}/src/lib/creditCalculationLabels.ts`, 'utf8');

    [
      'Francés',
      'Interés simple',
      'Mora compuesta',
      'Método no clasificado',
      'Valor no clasificado',
    ].forEach((text) => {
      expect(source).not.toContain(text);
    });
  });
});
