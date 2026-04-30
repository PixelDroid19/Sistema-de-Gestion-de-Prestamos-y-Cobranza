import { describe, expect, it } from 'vitest';
import {
  formatAuditEntity,
  getAuditEntityTypeLabel,
  normalizeAuditEntityTypeInput,
} from '../../lib/auditPresentation';

describe('Audit presentation helpers', () => {
  it('renders backend entity types with operator-friendly labels', () => {
    expect(getAuditEntityTypeLabel('Loan')).toBe('Crédito');
    expect(formatAuditEntity({ entityType: 'Payment', entityId: '23' })).toBe('Pago #23');
  });

  it('accepts Spanish entity type aliases for audit filters', () => {
    expect(normalizeAuditEntityTypeInput('Crédito')).toBe('Loan');
    expect(normalizeAuditEntityTypeInput('pagos')).toBe('Payment');
    expect(normalizeAuditEntityTypeInput('CustomEntity')).toBe('CustomEntity');
  });
});
