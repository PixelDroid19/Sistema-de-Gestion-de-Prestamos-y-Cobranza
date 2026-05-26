import { describe, expect, it } from 'vitest';
import { computeCapitalPreview } from '../creditDetailsHelpers';

describe('computeCapitalPreview', () => {
  it('uses the current outstanding principal after capital payments', () => {
    const preview = computeCapitalPreview(
      '300000',
      'reduce_payment',
      '10',
      {
        amount: 1000000,
        principalOutstanding: 1000000,
        installmentAmount: 120000,
        interestRate: 24,
      },
      {
        outstandingPrincipal: 600000,
        outstandingInstallments: 10,
        nextInstallment: {
          scheduledPayment: 85000,
        },
      },
    );

    expect(preview.currentPrincipal).toBe(600000);
    expect(preview.newPrincipal).toBe(300000);
    expect(preview.remainingInstallments).toBe(10);
    expect(preview.estimatedPayment).toBeGreaterThan(0);
    expect(preview.estimatedPayment).toBeLessThan(85000);
  });
});
