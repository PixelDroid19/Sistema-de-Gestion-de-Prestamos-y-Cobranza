import { describe, expect, it } from 'vitest';

import { computeCapitalPreview, formatOperationalStatus, getStatusInfo } from '../creditDetails/creditDetailsHelpers';

describe('creditDetailsHelpers', () => {
  it('keeps the capital preview neutral for malformed capital amounts', () => {
    const preview = computeCapitalPreview(
      '100e2',
      'reduce_term',
      '',
      { interestRate: 0, installmentAmount: 100000 },
      {
        outstandingPrincipal: 500000,
        outstandingInstallments: 5,
        nextInstallment: { scheduledPayment: 100000 },
      },
    );

    expect(preview.amount).toBe(0);
    expect(preview.newPrincipal).toBe(500000);
    expect(preview.estimatedInstallments).toBe(5);
  });

  it('keeps the capital preview on the current term for malformed new-term values', () => {
    const preview = computeCapitalPreview(
      '100000',
      'reduce_payment',
      '1e2',
      { interestRate: 0, installmentAmount: 100000 },
      {
        outstandingPrincipal: 500000,
        outstandingInstallments: 5,
        nextInstallment: { scheduledPayment: 100000 },
      },
    );

    expect(preview.amount).toBe(100000);
    expect(preview.newPrincipal).toBe(400000);
    expect(preview.estimatedInstallments).toBe(5);
    expect(preview.estimatedPayment).toBe(80000);
  });

  it('uses an operational fallback for unknown history statuses', () => {
    expect(formatOperationalStatus('manual_hold')).toBe('Estado no clasificado');
  });

  it('uses an operational fallback for unknown loan detail statuses', () => {
    expect(getStatusInfo('written_off').label).toBe('Estado no clasificado');
  });
});
