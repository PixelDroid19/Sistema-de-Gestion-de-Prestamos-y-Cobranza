import { describe, expect, it } from 'vitest';
import { resolveOperationalGuard } from '../operationalGuards';

describe('resolveOperationalGuard', () => {
  it('uses operator-facing status labels in disabled credit action reasons', () => {
    const guard = resolveOperationalGuard('installment.pay', {
      role: 'admin',
      loanStatus: 'closed',
    });

    expect(guard).toMatchObject({
      visible: true,
      executable: false,
      reason: 'Crédito cerrado: acción no disponible.',
    });
    expect(guard.reason).not.toContain('closed');
  });

  it('uses operator-facing installment labels in disabled installment reasons', () => {
    const guard = resolveOperationalGuard('installment.pay', {
      role: 'admin',
      loanStatus: 'active',
      installmentStatus: 'annulled',
    });

    expect(guard).toMatchObject({
      visible: true,
      executable: false,
      reason: 'Cuota anulada: acción no disponible.',
    });
    expect(guard.reason).not.toContain('annulled');
  });

  it('allows permissioned employees to execute backoffice payment actions', () => {
    const guard = resolveOperationalGuard('capital.payment', {
      role: 'employee',
      permissions: ['PAYMENTS_CREATE'],
      loanStatus: 'active',
    });

    expect(guard).toMatchObject({
      visible: true,
      executable: true,
    });
  });

  it('hides backoffice financial actions from employees without the required permission', () => {
    const guard = resolveOperationalGuard('capital.payment', {
      role: 'employee',
      permissions: [],
      loanStatus: 'active',
    });

    expect(guard).toMatchObject({
      visible: false,
      executable: false,
      reason: 'No cuenta con permisos para ejecutar esta acción.',
    });
  });

  it('keeps sensitive late-fee updates admin-only even when an employee has credit update permissions', () => {
    const guard = resolveOperationalGuard('lateFee.update', {
      role: 'employee',
      permissions: ['CREDITS_UPDATE'],
      loanStatus: 'active',
    });

    expect(guard).toMatchObject({
      visible: false,
      executable: false,
      reason: 'Solo administradores pueden actualizar la tasa de mora.',
    });
  });
});
