import { describe, expect, it } from 'vitest';

import {
  computeCapitalPreview,
  formatCapitalPaymentDenialReason,
  formatOperationalStatus,
  formatPayoffDenialReason,
  formatPromiseStatus,
  getStatusInfo,
} from '../creditDetails/creditDetailsHelpers';

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

  it('uses operational fallbacks for unknown promise statuses', () => {
    expect(formatPromiseStatus('manual_hold')).toBe('Estado no clasificado');
    expect(formatPromiseStatus('')).toBe('Sin estado');
  });

  it('does not expose unknown payoff denial backend messages', () => {
    const message = formatPayoffDenialReason({
      code: 'PAYOFF_POLICY_SNAPSHOT_MISSING',
      message: 'PolicySnapshotBuilder failed for calculationProfileVersionId=17',
    });

    expect(message).toBe('El pago total no está disponible para el estado financiero actual.');
    expect(message).not.toMatch(/PolicySnapshotBuilder|calculationProfileVersionId/i);
  });

  it('does not expose unknown capital payment denial backend messages', () => {
    const message = formatCapitalPaymentDenialReason({
      code: 'CAPITAL_PAYMENT_STATE_MACHINE_BLOCK',
      message: 'state_machine blocked by payableInterestAmount',
    });

    expect(message).toBe('El abono a capital no está disponible para el estado financiero actual.');
    expect(message).not.toMatch(/state_machine|payableInterestAmount/i);
  });

  it('does not expose no-code payoff denial backend messages', () => {
    const message = formatPayoffDenialReason({
      message: 'PayoffPolicyResolver failed for calculationProfileVersionId=17',
    });

    expect(message).toBe('El pago total no está disponible para el estado financiero actual.');
    expect(message).not.toMatch(/PayoffPolicyResolver|calculationProfileVersionId/i);
  });

  it('does not expose no-code capital payment denial backend messages', () => {
    const message = formatCapitalPaymentDenialReason({
      message: 'Loan has no outstanding balance for capital payment',
    });

    expect(message).toBe('El abono a capital no está disponible para el estado financiero actual.');
    expect(message).not.toMatch(/Loan has no outstanding balance/i);
  });
});
