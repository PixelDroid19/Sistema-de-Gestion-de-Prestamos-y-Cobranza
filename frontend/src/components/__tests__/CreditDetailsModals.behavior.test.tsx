import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreditDetailsModals, type CreditDetailsModalsProps } from '../creditDetails/CreditDetailsModals';

const noop = () => {};

const buildProps = (overrides: Partial<CreditDetailsModalsProps> = {}): CreditDetailsModalsProps => ({
  formatCurrency: () => '$0.00',
  paymentMethodOptions: [{ value: 'cash', label: 'Efectivo' }],
  showStatusModal: false,
  newStatus: '',
  onNewStatusChange: noop,
  onUpdateStatus: noop,
  onCloseStatusModal: noop,
  isRecordPaymentModalOpen: false,
  selectedInstallmentNumber: null,
  paymentAmount: '',
  paymentDate: '2026-05-31',
  paymentMethod: 'cash',
  installmentQuote: null,
  installmentQuoteFetching: false,
  installmentQuoteError: false,
  onPaymentAmountChange: noop,
  onPaymentDateChange: noop,
  onPaymentMethodChange: noop,
  onRecordPayment: noop,
  onClosePaymentModal: noop,
  isPromiseModalOpen: false,
  promiseAmount: '',
  promiseDateInput: '2026-05-31',
  promiseNotes: '',
  onPromiseAmountChange: noop,
  onPromiseDateChange: noop,
  onPromiseNotesChange: noop,
  onCreatePromise: noop,
  onClosePromiseModal: noop,
  isFollowUpModalOpen: false,
  followUpNotes: '',
  onFollowUpNotesChange: noop,
  onCreateFollowUp: noop,
  onCloseFollowUpModal: noop,
  showAnnulModal: false,
  annulInstallmentNumber: null,
  annulReason: '',
  onAnnulReasonChange: noop,
  onAnnulInstallment: noop,
  onCloseAnnulModal: noop,
  showCapitalModal: false,
  capitalAmount: '',
  capitalPaymentDate: '2026-05-31',
  capitalMethod: 'cash',
  capitalStrategy: 'reduce_term',
  capitalNewTermMonths: '',
  capitalPreview: {
    amount: 0,
    currentPrincipal: 1000,
    newPrincipal: 1000,
    currentInstallment: 0,
    estimatedPayment: 0,
    estimatedInstallments: 1,
    remainingInstallments: 1,
  },
  capitalPaymentGuard: { executable: true },
  capitalUnavailableDescription: '',
  onCapitalAmountChange: noop,
  onCapitalDateChange: noop,
  onCapitalMethodChange: noop,
  onCapitalStrategyChange: noop,
  onCapitalNewTermMonthsChange: noop,
  onRecordCapital: noop,
  onCloseCapitalModal: noop,
  showEditPaymentMethodModal: false,
  editingPaymentReconciled: false,
  newPaymentMethod: 'cash',
  onNewPaymentMethodChange: noop,
  onUpdatePaymentMethod: noop,
  onCloseEditPaymentMethodModal: noop,
  showLateFeeModal: false,
  lateFeeRate: '',
  onLateFeeRateChange: noop,
  onUpdateLateFeeRate: noop,
  onCloseLateFeeModal: noop,
  ...overrides,
});

describe('CreditDetailsModals behavior', () => {
  it('closes the status modal from Escape through the shared modal shell', async () => {
    const user = userEvent.setup();
    const onCloseStatusModal = vi.fn();

    render(
      <CreditDetailsModals
        {...buildProps({
          showStatusModal: true,
          onCloseStatusModal,
        })}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Cambiar estado' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onCloseStatusModal).toHaveBeenCalledTimes(1);
  });
});
