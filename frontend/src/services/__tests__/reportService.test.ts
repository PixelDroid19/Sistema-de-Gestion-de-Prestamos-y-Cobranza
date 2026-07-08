import { describe, expect, it } from 'vitest';

import { normalizePaymentSchedulePayload } from '../reportService';

describe('reportService payment schedule normalization', () => {
  it('normalizes the local mock payment schedule payload used by report QA', () => {
    const normalized = normalizePaymentSchedulePayload({
      loan: {
        id: 77,
        customerName: 'Andrés Ruiz',
        amount: 9200000,
        rate: 0.6,
        totalInstallments: 12,
        frequency: 'monthly',
      },
      summary: {
        totalDue: '12400000.00',
        totalPaid: '6200000.00',
        remaining: '6200000.00',
      },
      schedule: [
        {
          installmentNumber: 1,
          dueDate: '2026-01-23',
          amount: '1033333.00',
          principalAmount: '620000.00',
          interestAmount: '413333.00',
          status: 'paid',
        },
        {
          installmentNumber: 2,
          dueDate: '2026-02-23',
          amount: '1033333.00',
          principalAmount: '620000.00',
          interestAmount: '413333.00',
          status: 'overdue',
        },
      ],
    });

    expect(normalized.loan.interestRate).toBe(60);
    expect(normalized.loan.termMonths).toBe(12);
    expect(normalized.summary.totalInstallments).toBe(12);
    expect(normalized.summary.paidInstallments).toBe(1);
    expect(normalized.summary.pendingInstallments).toBe(11);
    expect(normalized.schedule[0].openingBalance).toBe(9200000);
    expect(normalized.schedule[0].scheduledPayment).toBe(1033333);
    expect(normalized.schedule[0].principalComponent).toBe(620000);
    expect(normalized.schedule[0].interestComponent).toBe(413333);
    expect(normalized.schedule[0].remainingBalance).toBe(8580000);
    expect(normalized.schedule[1].openingBalance).toBe(8580000);
    expect(normalized.schedule[1].remainingBalance).toBe(7960000);
  });
});
