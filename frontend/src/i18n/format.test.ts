import { describe, expect, it } from 'vitest';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, isValidOperationalDateOnly } from './format';

describe('currency formatting', () => {
  it('renders Colombian pesos with an explicit COP code', () => {
    expect(formatCurrency(2000000)).toBe('COP 2.000.000');
    expect(formatCurrency(120554.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('COP 120.554,50');
    expect(formatCurrency(-15868470)).toBe('COP -15.868.470');
  });

  it('renders compact chart values with the COP code', () => {
    expect(formatCompactCurrency(1500000)).toContain('COP');
    expect(formatCompactCurrency(0)).toContain('COP');
  });
});

describe('date formatting safety', () => {
  it('formats valid operational dates', () => {
    expect(formatDate('2026-02-14', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })).toContain('2026');
    expect(formatDate('2026-02-14', { day: '2-digit', month: '2-digit', year: 'numeric' })).toContain('2026');
    expect(formatDateTime('2026-02-14T08:30:00.000Z')).toContain('2026');
  });

  it('does not render malformed or out-of-range dates', () => {
    expect(formatDate('60620-02-02')).toBe('');
    expect(formatDate('+060517-02-14T00:00:00.000Z')).toBe('');
    expect(formatDate('2026-02-31')).toBe('');
    expect(formatDateTime(new Date('+060517-02-14T00:00:00.000Z'))).toBe('');
  });

  it('validates strict date-only input for forms', () => {
    expect(isValidOperationalDateOnly('2026-02-14')).toBe(true);
    expect(isValidOperationalDateOnly('2026-02-31')).toBe(false);
    expect(isValidOperationalDateOnly('60620-02-02')).toBe(false);
  });
});
