import { describe, expect, it } from 'vitest';

import {
  formatCapitalPaymentDenialReason,
  formatOperationalStatus,
  formatPayoffDenialReason,
  formatPromiseStatus,
  getStatusInfo,
} from '../creditDetails/creditDetailsHelpers';

describe('creditDetailsHelpers', () => {
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

  it('explains that the current installment must be paid before a capital payment', () => {
    const message = formatCapitalPaymentDenialReason({
      code: 'CURRENT_INSTALLMENT_PAYMENT_REQUIRED',
      message: 'Primero paga completamente la cuota vigente #2 antes de abonar a capital',
    });

    expect(message).toBe('Primero paga completamente la cuota vigente antes de abonar a capital.');
  });
});
