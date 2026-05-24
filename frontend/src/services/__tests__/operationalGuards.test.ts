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

  it('allows employees with backend payment view permission to navigate to collections', () => {
    const guard = resolveOperationalGuard('credit.payouts.navigate', {
      role: 'employee',
      permissions: ['PAYMENTS_VIEW_ALL'],
      loanStatus: 'active',
    });

    expect(guard).toMatchObject({
      visible: true,
      executable: true,
    });
  });

  it('allows employees with backend reverse permission to annul installments', () => {
    const guard = resolveOperationalGuard('installment.annul', {
      role: 'employee',
      permissions: ['PAYMENTS_REVERSE'],
      loanStatus: 'active',
      installmentStatus: 'pending',
    });

    expect(guard).toMatchObject({
      visible: true,
      executable: true,
    });
  });

  it('does not expose payout registration to customer records', () => {
    const guard = resolveOperationalGuard('payout.register', {
      role: 'customer',
      permissions: ['*'],
      payoutType: 'regular',
    });

    expect(guard).toMatchObject({
      visible: false,
      executable: false,
      reason: 'Solo el equipo autorizado puede registrar pagos.',
    });
  });

  it('does not expose payout vouchers to associate records', () => {
    const guard = resolveOperationalGuard('payout.voucher.download', {
      role: 'socio',
      permissions: ['*'],
    });

    expect(guard).toMatchObject({
      visible: false,
      executable: false,
      reason: 'Acción disponible solo para usuarios administrativos.',
    });
  });

  it('does not expose internal report exports to associate records', () => {
    const guard = resolveOperationalGuard('credit.report.download', {
      role: 'socio',
      permissions: ['*'],
    });

    expect(guard).toMatchObject({
      visible: false,
      executable: false,
      reason: 'Acción disponible solo para usuarios administrativos.',
    });
  });

  it('uses the backend report view permission for credit report downloads', () => {
    const allowed = resolveOperationalGuard('credit.report.download', {
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL'],
    });
    const exportOnly = resolveOperationalGuard('credit.report.download', {
      role: 'employee',
      permissions: ['REPORTS_EXPORT'],
    });

    expect(allowed).toMatchObject({
      visible: true,
      executable: true,
    });
    expect(exportOnly).toMatchObject({
      visible: false,
      executable: false,
      reason: 'No cuenta con permisos para ejecutar esta acción.',
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

  it('describes credit delete action as logical cancellation instead of physical deletion', () => {
    const hidden = resolveOperationalGuard('credit.delete', {
      role: 'employee',
      permissions: ['CREDITS_DELETE'],
      loanStatus: 'rejected',
    });
    const blocked = resolveOperationalGuard('credit.delete', {
      role: 'admin',
      loanStatus: 'closed',
    });
    const active = resolveOperationalGuard('credit.delete', {
      role: 'admin',
      loanStatus: 'active',
    });
    const rejected = resolveOperationalGuard('credit.delete', {
      role: 'admin',
      loanStatus: 'rejected',
    });

    expect(hidden.reason).toBe('Solo administradores pueden cancelar créditos.');
    expect(blocked.reason).toBe('No se puede cancelar un crédito cerrado o completado.');
    expect(active).toMatchObject({
      visible: true,
      executable: false,
      reason: 'Solo se pueden cancelar créditos rechazados.',
    });
    expect(rejected).toMatchObject({
      visible: true,
      executable: true,
    });
  });
});
