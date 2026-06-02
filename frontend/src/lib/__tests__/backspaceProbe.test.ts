import { describe, expect, it } from 'vitest';

import {
  formatDecimalMoneyInput,
  normalizeGroupedDecimalMoneyEdit,
} from '../moneyInput';

const endBackspace = (display: string) => display.slice(0, -1);

describe('decimal money realistic end-backspace', () => {
  it('walks from 120.554,50 to empty using grouped delete normalization', () => {
    const failures: Array<{ display: string; canonical: string | null; formatted: string | null }> = [];
    let display = '120.554,50';
    let canonical = '120554.50';

    for (let step = 0; step < 40; step += 1) {
      const formatted = formatDecimalMoneyInput(canonical);
      if (formatted !== display) {
        failures.push({ display, canonical, formatted });
      }

      if (!display) {
        break;
      }

      const nextDisplay = endBackspace(display);
      const nextCanonical = normalizeGroupedDecimalMoneyEdit(canonical, display, nextDisplay);
      if (nextCanonical === null) {
        failures.push({ display: nextDisplay, canonical: nextCanonical, formatted: null });
        break;
      }

      canonical = nextCanonical;
      display = formatDecimalMoneyInput(canonical);
    }

    expect(failures).toEqual([]);
    expect(canonical).toBe('');
  });
});
