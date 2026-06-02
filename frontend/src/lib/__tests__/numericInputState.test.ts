import { describe, expect, it } from 'vitest';

import {
  formatNumericInputValue,
  sanitizeNumericInputNumber,
} from '../numericInputState';

describe('numericInputState', () => {
  it('formats finite values and empties as empty string', () => {
    expect(formatNumericInputValue(100)).toBe('100');
    expect(formatNumericInputValue(undefined)).toBe('');
    expect(formatNumericInputValue(null)).toBe('');
    expect(formatNumericInputValue(Number.NaN)).toBe('');
  });

  it('keeps only finite numeric values and normalizes invalid values to NaN', () => {
    expect(sanitizeNumericInputNumber(100)).toBe(100);
    expect(Number.isNaN(sanitizeNumericInputNumber(null))).toBe(true);
    expect(Number.isNaN(sanitizeNumericInputNumber(undefined))).toBe(true);
    expect(Number.isNaN(sanitizeNumericInputNumber(Number.NaN))).toBe(true);
    expect(Number.isNaN(sanitizeNumericInputNumber(Infinity))).toBe(true);
  });
});

