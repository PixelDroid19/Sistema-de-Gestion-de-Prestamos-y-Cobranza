import { describe, expect, it } from 'vitest';

import {
  canonicalAfterOneMoneyBackspace,
  countDigitsBeforeCursor,
  cursorAfterDigitOffset,
  formatDecimalMoneyInput,
  formatDigitGroups,
  formatWholeMoneyInput,
  normalizeDecimalInput,
  normalizeDecimalMoneyInput,
  normalizeGroupedDecimalMoneyEdit,
  normalizeIntegerInput,
  normalizePercentInput,
  normalizeTextInput,
  normalizeWholeMoneyInput,
  parseFormattedPositiveMoneyInput,
  parsePercentageWithPrecisionInput,
  parsePercentageRateInput,
  parsePositiveIntegerInput,
  parsePositiveMoneyInput,
  removeTrailingDigitsFromCanonical,
  resolveGroupedMoneyCursorAfterDelete,
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

describe('grouped money cursor helpers', () => {
  it('keeps the caret on the same digit when separators are reformatted', () => {
    const previousDisplay = '120.554';
    const nextFormatted = '12.055';

    expect(
      resolveGroupedMoneyCursorAfterDelete(
        previousDisplay,
        nextFormatted,
        previousDisplay.length,
        previousDisplay.length,
        'Backspace',
      ),
    ).toBe(nextFormatted.length);

    expect(countDigitsBeforeCursor('120.554,50', '120.554,50'.length)).toBe(8);
    expect(cursorAfterDigitOffset('120.554,5', 7)).toBe('120.554,5'.length);
  });
});

describe('formatted decimal money input', () => {
  it('normalizes es-CO grouped decimals into canonical dot values', () => {
    expect(normalizeDecimalMoneyInput('120.554,50')).toBe('120554.50');
    expect(normalizeDecimalMoneyInput('$ 120.554,50')).toBe('120554.50');
    expect(normalizeDecimalMoneyInput('COP 120.554,50')).toBe('120554.50');
    expect(formatDecimalMoneyInput('120554.50')).toBe('120.554,50');
    expect(parsePositiveMoneyInput('120554.50')).toBe(120554.5);
  });

  it('formats whole peso groups while typing decimals', () => {
    expect(formatDecimalMoneyInput('120554')).toBe('120.554');
    expect(formatDecimalMoneyInput('120554.')).toBe('120.554,');
    expect(formatDecimalMoneyInput('120554.5')).toBe('120.554,5');
  });

  it('normalizes empty and partial grouped decimal edits', () => {
    expect(normalizeDecimalMoneyInput('')).toBe('');
    expect(normalizeDecimalMoneyInput('120.554,5')).toBe('120554.5');
    expect(normalizeDecimalMoneyInput('120554.')).toBe('120554.');
    expect(normalizeDecimalMoneyInput('120.554,')).toBe('120554.');
    expect(normalizeDecimalMoneyInput('120.554')).toBe('120554');
    expect(normalizeDecimalMoneyInput('120.55')).toBe('12055');
    expect(normalizeDecimalMoneyInput('120.')).toBe('120.');
  });

  it('treats grouped whole amounts without comma as thousand separators', () => {
    expect(normalizeDecimalMoneyInput('120.554')).toBe('120554');
    expect(formatDecimalMoneyInput('120554')).toBe('120.554');
  });

  it('resolves ambiguous delete states using the previous canonical value', () => {
    expect(normalizeGroupedDecimalMoneyEdit('120554', '120.554', '120.55')).toBe('12055');
    expect(normalizeGroupedDecimalMoneyEdit('120554.50', '120.554,50', '120.554,5')).toBe('120554.5');
    expect(normalizeGroupedDecimalMoneyEdit('120554.50', '120.554,50', '')).toBe('');
    expect(normalizeGroupedDecimalMoneyEdit('250000.00', '250.000,00', '1e2')).toBeNull();
  });

  it('removes trailing canonical digits one step at a time', () => {
    expect(canonicalAfterOneMoneyBackspace('120554.50')).toBe('120554.5');
    expect(canonicalAfterOneMoneyBackspace('120554.')).toBe('120554');
    expect(canonicalAfterOneMoneyBackspace('120554')).toBe('12055');
    expect(removeTrailingDigitsFromCanonical('120554.50', 3)).toBe('120554');
  });

  it('keeps canonical values stable while deleting grouped decimals step by step', () => {
    const displaySteps = [
      { display: '120.554,50', canonical: '120554.50' },
      { display: '120.554,5', canonical: '120554.5' },
      { display: '120.554,', canonical: '120554.' },
      { display: '120.554', canonical: '120554' },
      { display: '12.055', canonical: '12055' },
      { display: '1.205', canonical: '1205' },
      { display: '120,', canonical: '120.' },
      { display: '120', canonical: '120' },
      { display: '12', canonical: '12' },
      { display: '1', canonical: '1' },
      { display: '', canonical: '' },
    ];

    displaySteps.forEach(({ display, canonical }) => {
      expect(normalizeDecimalMoneyInput(display)).toBe(canonical);
      expect(formatDecimalMoneyInput(canonical)).toBe(display || '');
    });
  });
});

describe('formatted whole money input', () => {
  it('normalizes readable money values while preserving a canonical numeric string', () => {
    expect(normalizeWholeMoneyInput('$ 2.000.000')).toBe('2000000');
    expect(normalizeWholeMoneyInput('COP 2.000.000')).toBe('2000000');
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
