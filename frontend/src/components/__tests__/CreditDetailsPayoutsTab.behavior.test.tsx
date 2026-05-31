import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PayoutsTab } from '../creditDetails/PayoutsTab';

const renderPayoutsTab = (onDownloadVoucher = vi.fn()) => {
  render(
    <PayoutsTab
      paymentHistoryEntries={[
        {
          id: 9001,
          paymentId: 9001,
          amount: 250000,
          principalApplied: 200000,
          interestApplied: 50000,
          penaltyApplied: 0,
          paymentType: 'partial',
          installmentNumber: 2,
          paymentMethod: 'transfer',
          date: '2026-04-27T00:00:00.000Z',
          status: 'completed',
          createdBy: { name: 'Admin Operativo' },
        },
      ]}
      formatCurrency={(value) => `$${value}`}
      formatDate={() => '27/04/2026'}
      formatPaymentMethod={() => 'Transferencia'}
      onDownloadVoucher={onDownloadVoucher}
    />,
  );
};

describe('CreditDetails payouts tab', () => {
  it('keeps raw payment identifiers out of the payment history table', () => {
    renderPayoutsTab();

    expect(screen.queryByRole('columnheader', { name: /id pago/i })).not.toBeInTheDocument();
    expect(screen.queryByText('#9001')).not.toBeInTheDocument();
  });

  it('still downloads the voucher using the hidden payment identifier', () => {
    const onDownloadVoucher = vi.fn();
    renderPayoutsTab(onDownloadVoucher);

    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));

    expect(onDownloadVoucher).toHaveBeenCalledWith(9001);
  });
});
