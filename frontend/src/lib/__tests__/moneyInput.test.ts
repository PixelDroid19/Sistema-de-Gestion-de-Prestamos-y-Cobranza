import { describe, expect, it } from 'vitest';

import {
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
