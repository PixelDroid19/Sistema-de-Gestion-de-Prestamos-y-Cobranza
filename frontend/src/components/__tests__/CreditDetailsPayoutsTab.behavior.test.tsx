import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PayoutsTab } from '../creditDetails/PayoutsTab';

const renderPayoutsTab = (renderPaymentRowActions = vi.fn()) => {
  const onDownloadVoucher = vi.fn();
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
      renderPaymentRowActions={(entry, options) => {
        renderPaymentRowActions(entry, options);
        return (
          <button type="button" onClick={() => onDownloadVoucher(9001)}>
            Descargar comprobante
          </button>
        );
      }}
    />,
  );
  return { onDownloadVoucher };
};

describe('CreditDetails payouts tab', () => {
  it('keeps raw payment identifiers out of the payment history table', () => {
    renderPayoutsTab();

    expect(screen.queryByRole('columnheader', { name: /id pago/i })).not.toBeInTheDocument();
    expect(screen.queryByText('#9001')).not.toBeInTheDocument();
  });

  it('still downloads the voucher using the hidden payment identifier', () => {
    const onDownloadVoucher = vi.fn();
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
        renderPaymentRowActions={() => (
          <button type="button" onClick={() => onDownloadVoucher(9001)}>
            Descargar comprobante
          </button>
        )}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Descargar comprobante' })[0]);

    expect(onDownloadVoucher).toHaveBeenCalledWith(9001);
  });

  it('uses AppTable financial variant for the desktop payment history grid', () => {
    renderPayoutsTab();
    expect(screen.getByTestId('credit-payouts-table')).toBeInTheDocument();
  });
});
