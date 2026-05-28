import { describe, expect, it } from 'vitest';

import {
  formatDigitGroups,
  formatWholeMoneyInput,
  normalizeDecimalInput,
  normalizeIntegerInput,
  normalizePercentInput,
  normalizeTextInput,
  normalizeWholeMoneyInput,
  parseFormattedPositiveMoneyInput,
  parsePercentageWithPrecisionInput,
  parsePercentageRateInput,
  parsePositiveIntegerInput,
  parsePositiveMoneyInput,
} from '../moneyInput';

describe('parsePositiveMoneyInput', () => {
  it('accepts clean positive decimal amounts', () => {
    expect(parsePositiveMoneyInput('300000')).toBe(300000);
    expect(parsePositiveMoneyInput('300000.50')).toBe(300000.5);
  });

  it('rejects malformed or non-positive money input instead of truncating it', () => {
    expect(parsePositiveMoneyInput('300000abc')).toBeNull();
    expect(parsePositiveMoneyInput('300.000,50')).toBeNull();
    expect(parsePositiveMoneyInput('0')).toBeNull();
    expect(parsePositiveMoneyInput('-10')).toBeNull();
    expect(parsePositiveMoneyInput('')).toBeNull();
  });
});

describe('formatted whole money input', () => {
  it('normalizes readable money values while preserving a canonical numeric string', () => {
    expect(normalizeWholeMoneyInput('$ 2.000.000')).toBe('2000000');
    expect(normalizeWholeMoneyInput('2,000,000')).toBe('2000000');
    expect(formatWholeMoneyInput('2000000')).toBe('2.000.000');
    expect(parseFormattedPositiveMoneyInput('2.000.000')).toBe(2000000);
  });

  it('formats very large digit strings without losing precision', () => {
    expect(formatDigitGroups('123456789012345678901234')).toBe('123.456.789.012.345.678.901.234');
    expect(formatWholeMoneyInput('123456789012345678901234')).toBe('123.456.789.012.345.678.901.234');
    expect(parseFormattedPositiveMoneyInput('123456789012345678901234')).toBeNull();
  });

  it('rejects exponent, signed, and mixed money text', () => {
    expect(normalizeWholeMoneyInput('100e2')).toBeNull();
    expect(normalizeWholeMoneyInput('-100')).toBeNull();
    expect(normalizeWholeMoneyInput('100abc')).toBeNull();
    expect(parseFormattedPositiveMoneyInput('')).toBeNull();
    expect(parseFormattedPositiveMoneyInput('0')).toBeNull();
  });
});

describe('general normalized inputs', () => {
  it('normalizes bounded integers and rejects unsafe or out-of-range values', () => {
    expect(normalizeIntegerInput('0', { min: 1, max: 28 })).toBe('0');
    expect(normalizeIntegerInput('0012', { min: 1, max: 28 })).toBe('12');
    expect(normalizeIntegerInput('0', { allowZero: true })).toBe('0');
    expect(normalizeIntegerInput('29', { min: 1, max: 28 })).toBeNull();
    expect(normalizeIntegerInput('1e2')).toBeNull();
    expect(normalizeIntegerInput('9007199254740993')).toBeNull();
  });

  it('normalizes decimals with precision limits for small rates', () => {
    expect(normalizeDecimalInput('0.', { maxDecimals: 4 })).toBe('0.');
    expect(normalizeDecimalInput('0,25', { allowZero: true, maxDecimals: 4 })).toBe('0.25');
    expect(normalizeDecimalInput('.5', { allowZero: true, maxDecimals: 4 })).toBe('0.5');
    expect(normalizeDecimalInput('2.12345', { maxDecimals: 4 })).toBeNull();
    expect(normalizeDecimalInput('-2.1', { maxDecimals: 4 })).toBeNull();
  });

  it('normalizes percentages inside 0-100', () => {
    expect(normalizePercentInput('0', { maxDecimals: 4 })).toBe('0');
    expect(normalizePercentInput('2.5', { maxDecimals: 4 })).toBe('2.5');
    expect(normalizePercentInput('100.0001', { maxDecimals: 4 })).toBeNull();
    expect(normalizePercentInput('101', { maxDecimals: 4 })).toBeNull();
  });

  it('normalizes text independently from numeric rules', () => {
    expect(normalizeTextInput('  Socio QA  ', { trim: true })).toBe('Socio QA');
    expect(normalizeTextInput('abcdef', { maxLength: 3 })).toBe('abc');
  });
});

describe('parsePositiveIntegerInput', () => {
  it('accepts plain positive integer strings only', () => {
    expect(parsePositiveIntegerInput('10')).toBe(10);
    expect(parsePositiveIntegerInput('0010')).toBe(10);
  });

  it('rejects decimal, exponent, and mixed integer values', () => {
    expect(parsePositiveIntegerInput('1e2')).toBeNull();
    expect(parsePositiveIntegerInput('10.5')).toBeNull();
    expect(parsePositiveIntegerInput('10abc')).toBeNull();
    expect(parsePositiveIntegerInput('0')).toBeNull();
    expect(parsePositiveIntegerInput('')).toBeNull();
  });
});

describe('parsePercentageRateInput', () => {
  it('accepts clean percentage rates from 0 to 100', () => {
    expect(parsePercentageRateInput('0')).toBe(0);
    expect(parsePercentageRateInput('20.5')).toBe(20.5);
    expect(parsePercentageRateInput('100')).toBe(100);
  });

  it('rejects exponent, mixed text, and out-of-range rates', () => {
    expect(parsePercentageRateInput('1e2')).toBeNull();
    expect(parsePercentageRateInput('20abc')).toBeNull();
    expect(parsePercentageRateInput('-1')).toBeNull();
    expect(parsePercentageRateInput('100.01')).toBeNull();
  });
});

describe('parsePercentageWithPrecisionInput', () => {
  it('accepts clean percentages within the requested decimal precision', () => {
    expect(parsePercentageWithPrecisionInput('0', 4)).toBe(0);
    expect(parsePercentageWithPrecisionInput('25.1234', 4)).toBe(25.1234);
    expect(parsePercentageWithPrecisionInput('100', 4)).toBe(100);
  });

  it('rejects exponent notation, out-of-range values, and excess precision', () => {
    expect(parsePercentageWithPrecisionInput('1e2', 4)).toBeNull();
    expect(parsePercentageWithPrecisionInput('25.12345', 4)).toBeNull();
    expect(parsePercentageWithPrecisionInput('-1', 4)).toBeNull();
    expect(parsePercentageWithPrecisionInput('100.0001', 4)).toBeNull();
  });
});
