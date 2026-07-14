import { describe, expect, it } from 'vitest';

import {
  calculatePeriodicReturn,
  getDefaultFirstPaymentDate,
  getFirstPaymentDateBounds,
  getNextConfiguredPaymentDate,
  isFirstPaymentDateWithinBounds,
  parseFirstPaymentTerms,
} from './associateCreationTerms';

const OPERATIONAL_NOW = new Date('2026-07-13T17:00:00.000Z');

describe('associate creation terms', () => {
  it('defaults the first payment to the next annual or monthly occurrence', () => {
    expect(getDefaultFirstPaymentDate('annual', OPERATIONAL_NOW)).toBe('2027-07-13');
    expect(getDefaultFirstPaymentDate('monthly', OPERATIONAL_NOW)).toBe('2026-08-13');
  });

  it('uses the Bogota operational day and clamps payment days to 28', () => {
    const lateUtcOnBogotaMonthEnd = new Date('2026-08-01T03:00:00.000Z');

    expect(getDefaultFirstPaymentDate('monthly', lateUtcOnBogotaMonthEnd)).toBe('2026-08-28');
    expect(getDefaultFirstPaymentDate('annual', lateUtcOnBogotaMonthEnd)).toBe('2027-07-28');
  });

  it('returns tomorrow and the next period as the allowed date bounds', () => {
    expect(getFirstPaymentDateBounds('annual', OPERATIONAL_NOW)).toEqual({
      min: '2026-07-14',
      max: '2027-07-13',
    });
    expect(getFirstPaymentDateBounds('monthly', OPERATIONAL_NOW)).toEqual({
      min: '2026-07-14',
      max: '2026-08-13',
    });
  });

  it('derives the next visible date from stored payment terms', () => {
    expect(getNextConfiguredPaymentDate({
      interestType: 'annual',
      paymentDay: 15,
      paymentMonth: 12,
      today: OPERATIONAL_NOW,
    })).toBe('2026-12-15');

    expect(getNextConfiguredPaymentDate({
      interestType: 'monthly',
      paymentDay: 5,
      paymentMonth: 1,
      today: OPERATIONAL_NOW,
    })).toBe('2026-08-05');
  });

  it('parses a real date into the current API fields and rejects unsupported days', () => {
    expect(parseFirstPaymentTerms('2026-12-15')).toEqual({ day: '15', month: '12' });
    expect(parseFirstPaymentTerms('2026-02-29')).toBeNull();
    expect(parseFirstPaymentTerms('2026-07-29')).toBeNull();
    expect(parseFirstPaymentTerms('15/12/2026')).toBeNull();
  });

  it('validates the selected date against the active frequency period', () => {
    expect(isFirstPaymentDateWithinBounds('2027-07-13', 'annual', OPERATIONAL_NOW)).toBe(true);
    expect(isFirstPaymentDateWithinBounds('2027-07-14', 'annual', OPERATIONAL_NOW)).toBe(false);
    expect(isFirstPaymentDateWithinBounds('2026-08-13', 'monthly', OPERATIONAL_NOW)).toBe(true);
    expect(isFirstPaymentDateWithinBounds('2026-08-14', 'monthly', OPERATIONAL_NOW)).toBe(false);
    expect(isFirstPaymentDateWithinBounds('2026-07-13', 'monthly', OPERATIONAL_NOW)).toBe(false);
  });

  it('calculates the agreed return for one selected period', () => {
    expect(calculatePeriodicReturn(2_000_000, 12)).toBe(240_000);
    expect(calculatePeriodicReturn(2_000_000, 2.5)).toBe(50_000);
    expect(calculatePeriodicReturn(Number.NaN, 2.5)).toBe(0);
  });
});
