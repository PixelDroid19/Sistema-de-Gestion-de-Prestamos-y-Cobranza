import { describe, expect, it } from 'vitest';
import { getStandardFirstDueDate } from './creditDueDates';

describe('getStandardFirstDueDate', () => {
  it('keeps the origination day when possible and clamps month-end without rolling over', () => {
    expect(getStandardFirstDueDate('2026-01-05')).toBe('2026-02-05');
    expect(getStandardFirstDueDate('2026-01-31')).toBe('2026-02-28');
    expect(getStandardFirstDueDate('2028-01-31')).toBe('2028-02-29');
    expect(getStandardFirstDueDate('2026-02-31')).toBeNull();
  });
});
