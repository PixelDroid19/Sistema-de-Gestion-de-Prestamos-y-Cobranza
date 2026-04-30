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
      reason: 'Crédito Cerrado: acción no disponible.',
    });
    expect(guard.reason).not.toContain('closed');
  });

  it('uses operator-facing installment labels in disabled installment reasons', () => {
    const guard = resolveOperationalGuard('installment.pay', {
      role: 'customer',
      loanStatus: 'active',
      installmentStatus: 'annulled',
    });

    expect(guard).toMatchObject({
      visible: true,
      executable: false,
      reason: 'Cuota Anulada: acción no disponible.',
    });
    expect(guard.reason).not.toContain('annulled');
  });
});
