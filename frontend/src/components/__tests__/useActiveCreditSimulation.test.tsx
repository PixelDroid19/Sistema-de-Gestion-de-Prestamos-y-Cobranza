import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { creditCalculationService } from '../../services/creditCalculationService';
import { useActiveCreditSimulation } from '../hooks/useActiveCreditSimulation';

vi.mock('../../services/creditCalculationService', () => ({
  creditCalculationService: {
    calculate: vi.fn(),
  },
}));

const mockCalculate = vi.mocked(creditCalculationService.calculate);

describe('useActiveCreditSimulation', () => {
  beforeEach(() => {
    mockCalculate.mockReset();
  });

  it('keeps the current calculation fresh when syncing backend-applied policy values', async () => {
    mockCalculate.mockResolvedValue({
      data: {
        calculation: {
          calculationVersionId: 1,
          calculationProfileVersionId: 1,
          method: 'FRENCH',
          lateFeeMode: 'SIMPLE',
          inputs: {
            amount: 2000000,
            interestRate: 61,
            termMonths: 12,
            lateFeeMode: 'SIMPLE',
            annualLateFeeRate: 28.17,
            rateSource: 'policy',
            lateFeeSource: 'policy',
          },
          policySnapshot: {
            rateSource: 'policy',
            lateFeeSource: 'policy',
          },
          summary: {
            installmentAmount: 225651,
            totalPrincipal: 2000000,
            totalInterest: 707810,
            totalPayable: 2707810,
            outstandingBalance: 2707810,
            outstandingPrincipal: 2000000,
            outstandingInterest: 707810,
            outstandingInstallments: 12,
            nextInstallment: null,
          },
          schedule: [],
        },
      },
    } as any);

    const { result } = renderHook(() => useActiveCreditSimulation({
      initialInput: {
        amount: 2000000,
        interestRate: 60,
        termMonths: 12,
        lateFeeMode: 'SIMPLE',
        rateSource: 'policy',
        lateFeeSource: 'policy',
      },
      autoRun: false,
    }));

    await act(async () => {
      await result.current.simulate();
    });

    expect(result.current.isResultStale).toBe(false);

    act(() => {
      result.current.syncInputWithResult({
        interestRate: 61,
        annualLateFeeRate: 28.17,
        rateSource: 'policy',
        lateFeeSource: 'policy',
      });
    });

    expect(result.current.input.interestRate).toBe(61);
    expect(result.current.input.annualLateFeeRate).toBe(28.17);
    expect(result.current.isResultStale).toBe(false);
  });
});
