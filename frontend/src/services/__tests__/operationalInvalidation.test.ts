import { describe, expect, it, vi } from 'vitest';
import { invalidateAfterPayment } from '../operationalInvalidation';
import { queryKeys } from '../queryKeys';

describe('invalidateAfterPayment', () => {
  it('invalidates payoff quotes for the affected loan after financial mutations', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as Parameters<typeof invalidateAfterPayment>[0];

    await invalidateAfterPayment(queryClient, { loanId: 42 });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['loans.payoffQuote', 42],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reports.paymentSchedule(42),
    });
  });
});
