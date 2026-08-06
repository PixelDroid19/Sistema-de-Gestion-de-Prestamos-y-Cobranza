import { describe, expect, it } from 'vitest';

import {
  calculatePeriodicReturn,
  getDefaultFirstPaymentDate,
  getFirstPaymentDateBounds,
  getInvestmentMaturityDate,
  getNextConfiguredPaymentDate,
  isFirstPaymentDateWithinBounds,
  parseFirstPaymentTerms,
  parseInvestmentTermMonths,
} from './associateCreationTerms';

const OPERATIONAL_NOW = new Date('2026-07-13T17:00:00.000Z');

describe('associate creation terms', () => {
  it('defaults the first payment to the next monthly occurrence for either rate basis', () => {
    expect(getDefaultFirstPaymentDate('annual', OPERATIONAL_NOW)).toBe('2026-08-13');
    expect(getDefaultFirstPaymentDate('monthly', OPERATIONAL_NOW)).toBe('2026-08-13');
  });

  it('uses the Bogota operational day and clamps payment days to 28', () => {
    const lateUtcOnBogotaMonthEnd = new Date('2026-08-01T03:00:00.000Z');

    expect(getDefaultFirstPaymentDate('monthly', lateUtcOnBogotaMonthEnd)).toBe('2026-08-28');
    expect(getDefaultFirstPaymentDate('annual', lateUtcOnBogotaMonthEnd)).toBe('2026-08-28');
  });

  it('returns tomorrow and the next period as the allowed date bounds', () => {
    expect(getFirstPaymentDateBounds('annual', OPERATIONAL_NOW)).toEqual({
      min: '2026-07-14',
      max: '2026-08-13',
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
    })).toBe('2026-07-15');

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

  it('validates the selected date against the monthly payout window', () => {
    expect(isFirstPaymentDateWithinBounds('2026-08-13', 'annual', OPERATIONAL_NOW)).toBe(true);
    expect(isFirstPaymentDateWithinBounds('2026-08-14', 'annual', OPERATIONAL_NOW)).toBe(false);
    expect(isFirstPaymentDateWithinBounds('2026-08-13', 'monthly', OPERATIONAL_NOW)).toBe(true);
    expect(isFirstPaymentDateWithinBounds('2026-08-14', 'monthly', OPERATIONAL_NOW)).toBe(false);
    expect(isFirstPaymentDateWithinBounds('2026-07-13', 'monthly', OPERATIONAL_NOW)).toBe(false);
  });

  it('calculates the monthly return from the default annual rate basis', () => {
    expect(calculatePeriodicReturn(2_000_000, 12)).toBe(20_000);
    expect(calculatePeriodicReturn(2_000_000, 2.5, 'monthly')).toBe(50_000);
    expect(calculatePeriodicReturn(Number.NaN, 2.5)).toBe(0);
  });

  it('accepts a fixed investment term and derives the final scheduled payment date', () => {
    expect(parseInvestmentTermMonths('12')).toBe(12);
    expect(parseInvestmentTermMonths('')).toBeNull();
    expect(parseInvestmentTermMonths('0')).toBeNull();
    expect(parseInvestmentTermMonths('121')).toBeNull();
    expect(parseInvestmentTermMonths('12.5')).toBeNull();
    expect(getInvestmentMaturityDate('2026-08-13', 12)).toBe('2027-07-13');
    expect(getInvestmentMaturityDate('2026-08-13', 1)).toBe('2026-08-13');
  });
});
