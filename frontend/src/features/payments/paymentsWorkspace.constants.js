export const INSTALLMENT_STATUS_LABELS = {
  pending: 'payments.statuses.pending',
  overdue: 'payments.statuses.overdue',
  paid: 'payments.statuses.paid',
  partial: 'payments.statuses.partial',
  annulled: 'payments.statuses.annulled',
};

export const PAYMENT_TYPE_LABELS = {
  installment: 'payments.paymentTypeLabels.installment',
  payoff: 'payments.paymentTypeLabels.payoff',
  partial: 'payments.paymentTypeLabels.partial',
  capital: 'payments.paymentTypeLabels.capital',
};

export const PAYABLE_LOAN_STATUSES = new Set(['approved', 'active', 'defaulted', 'overdue']);

export const PAYMENT_TYPES_BY_ROLE = {
  admin: ['partial', 'capital'],
  customer: ['installment', 'partial', 'payoff'],
};

export const PAYMENT_ACTION_CONFIG = {
  payoff: {
    actionLabel: 'payments.actions.payoff.actionLabel',
    blockedTitle: 'payments.actions.payoff.blockedTitle',
    readyTitle: 'payments.actions.payoff.readyTitle',
    helperText: 'payments.actions.payoff.helperText',
  },
  capital: {
    actionLabel: 'payments.actions.capital.actionLabel',
    blockedTitle: 'payments.actions.capital.blockedTitle',
    readyTitle: 'payments.actions.capital.readyTitle',
    helperText: 'payments.actions.capital.helperText',
  },
};

export const STRUCTURED_PAYMENT_ERROR_CODES = new Set(['PAYOFF_NOT_ALLOWED', 'CAPITAL_PAYMENT_NOT_ALLOWED']);

export const initialFormState = {
  loanId: '',
  amount: '',
  paymentType: 'installment',
  payoffDate: new Date().toISOString().slice(0, 10),
};
