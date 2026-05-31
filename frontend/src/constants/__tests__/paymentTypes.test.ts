import { describe, expect, it } from 'vitest';
import { getPaymentMethodLabel } from '../paymentTypes';

describe('paymentTypes labels', () => {
  it('normalizes Spanish operator-entered payment method aliases', () => {
    expect(getPaymentMethodLabel('transferencia')).toBe('Transferencia');
    expect(getPaymentMethodLabel('efectivo')).toBe('Efectivo');
  });

  it('does not expose unknown code-like payment method keys', () => {
    expect(getPaymentMethodLabel('internal_gateway')).toBe('Método no clasificado');
  });
});
