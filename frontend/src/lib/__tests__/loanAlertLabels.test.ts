import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatLoanAlertTypeLabel } from '../loanAlertLabels';

describe('loan alert labels', () => {
  beforeEach(() => {
    localStorage.removeItem('app.locale');
  });

  it('renders supported alert types with operational labels', () => {
    expect(formatLoanAlertTypeLabel('overdue_installment')).toBe('Cuota vencida');
    expect(formatLoanAlertTypeLabel('promise_broken')).toBe('Compromiso incumplido');
  });

  it('uses the active locale for supported alert types', () => {
    localStorage.setItem('app.locale', 'en');

    expect(formatLoanAlertTypeLabel('overdue_installment')).toBe('Overdue installment');
  });

  it('does not expose unsupported alert type keys', () => {
    expect(formatLoanAlertTypeLabel('payment_state_machine_sync')).toBe('Alerta de crédito');
  });

  it('keeps visible alert labels in terminology dictionaries', () => {
    const source = readFileSync(`${process.cwd()}/src/lib/loanAlertLabels.ts`, 'utf8');

    [
      'Cuota vencida',
      'Pago próximo a vencer',
      'Alerta de crédito',
    ].forEach((text) => {
      expect(source).not.toContain(text);
    });
  });
});
