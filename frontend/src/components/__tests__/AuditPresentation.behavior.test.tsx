import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatAuditEntity,
  getAuditActionLabel,
  getAuditCategoryLabel,
  getAuditEntityTypeLabel,
  getAuditEventTypeLabel,
  getAuditModuleLabel,
  normalizeAuditEntityTypeInput,
} from '../../lib/auditPresentation';

describe('Audit presentation helpers', () => {
  beforeEach(() => {
    localStorage.removeItem('app.locale');
  });

  it('renders backend entity types with operator-friendly labels', () => {
    expect(getAuditEntityTypeLabel('Loan')).toBe('Crédito');
    expect(formatAuditEntity({ entityType: 'Payment', entityId: '23' })).toBe('Pago');
    expect(formatAuditEntity({ entityType: 'Payment', entityId: '23' })).not.toContain('#23');
  });

  it('does not expose unknown backend audit keys directly', () => {
    expect(getAuditModuleLabel('credit_policy_engine')).toBe('Área no clasificada');
    expect(getAuditActionLabel('PAYMENT_STATE_MACHINE_SYNC')).toBe('Acción no clasificada');
    expect(getAuditEventTypeLabel('credit.calculation_profile.rebuilt')).toBe('Evento no clasificado');
    expect(getAuditCategoryLabel('LOW_LEVEL_INTERNAL')).toBe('Categoría no clasificada');
    expect(getAuditEntityTypeLabel('CalculationProfileVersionPolicySnapshot')).toBe('Entidad no clasificada');
    expect(formatAuditEntity({ entityType: 'CalculationProfileVersionPolicySnapshot', entityId: '17' }))
      .toBe('Entidad no clasificada');
  });

  it('renders live audit event metadata with operator-friendly labels', () => {
    expect(getAuditModuleLabel('finances')).toBe('Finanzas');
    expect(getAuditEventTypeLabel('credit.created')).toBe('Crédito creado');
    expect(getAuditEventTypeLabel('payment.voucher.generated')).toBe('Comprobante generado');
    expect(getAuditCategoryLabel('SECURITY')).toBe('Seguridad');
    expect(getAuditCategoryLabel('BUSINESS')).toBe('Operación');
  });

  it('accepts Spanish entity type aliases for audit filters', () => {
    expect(normalizeAuditEntityTypeInput('Crédito')).toBe('Loan');
    expect(normalizeAuditEntityTypeInput('pagos')).toBe('Payment');
    expect(normalizeAuditEntityTypeInput('CustomEntity')).toBe('CustomEntity');
  });

  it('uses the active locale for presentation labels', () => {
    localStorage.setItem('app.locale', 'en');

    expect(getAuditModuleLabel('credits')).toBe('Loans');
    expect(getAuditActionLabel('CREATE')).toBe('Creation');
    expect(getAuditEventTypeLabel('credit.created')).toBe('Loan created');
    expect(getAuditCategoryLabel('BUSINESS')).toBe('Operation');
    expect(getAuditEntityTypeLabel('Loan')).toBe('Loan');
    expect(getAuditModuleLabel('credit_policy_engine')).toBe('Unclassified area');
  });
});
