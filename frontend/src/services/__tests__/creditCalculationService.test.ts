import { beforeEach, describe, expect, it, vi } from 'vitest';
import { creditCalculationService } from '../creditCalculationService';
import { apiClient } from '../../api/client';
import type { CreditCalculationInput } from '../../types/creditCalculation';

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const mockPost = vi.mocked(apiClient.post);

const input: CreditCalculationInput = {
  amount: 2000000,
  interestRate: 60,
  termMonths: 12,
  lateFeeMode: 'SIMPLE',
};

describe('creditCalculationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('app.locale');
  });

  it('rejects incomplete calculation responses with operational copy', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {},
      },
      status: 200,
      headers: new Headers(),
    });

    let caughtError: unknown;
    try {
      await creditCalculationService.calculate(input);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe('No se pudo leer el cálculo del crédito. Ejecuta el cálculo nuevamente.');
    expect((caughtError as Error).message).not.toMatch(/data\.calculation|calculationProfileVersionId/i);
  });
});
