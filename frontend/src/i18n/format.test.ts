import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, isValidOperationalDateOnly } from './format';

describe('date formatting safety', () => {
  it('formats valid operational dates', () => {
    expect(formatDate('2026-02-14', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })).toContain('2026');
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
