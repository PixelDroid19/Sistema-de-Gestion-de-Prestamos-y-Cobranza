import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';

import { exportMonthlyCashFlowExcel, exportMonthlyCashFlowPdf, normalizePaymentSchedulePayload } from '../reportService';

afterEach(() => vi.restoreAllMocks());

describe('cash flow downloads', () => {
  it('keeps the selected period in the filenames saved by the browser', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: new Blob(['report']), status: 200, headers: new Headers() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filenames.push(this.download);
    });
    for (const [filters, period] of [
      [{ fromDate: '2025-12-01', toDate: '2026-01-31' }, '2025-12-01-al-2026-01-31'],
      [{ fromDate: '2026-07-15', toDate: '2026-07-15' }, '2026-07-15'],
      [{ fromDate: '2026-07-01' }, 'desde-2026-07-01'],
      [{ toDate: '2026-07-31' }, 'hasta-2026-07-31'],
      [{}, '2026'],
    ] as const) {
      await exportMonthlyCashFlowExcel(2026, filters);
      await exportMonthlyCashFlowPdf(2026, filters);
      expect(filenames.slice(-2)).toEqual([
        `cierre-contable-mensual-${period}.xlsx`,
        `cierre-contable-mensual-${period}.pdf`,
      ]);
    }
  });
});

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
