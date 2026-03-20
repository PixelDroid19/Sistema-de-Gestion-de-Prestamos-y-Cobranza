import {
  PAYMENT_ACTION_CONFIG,
  STRUCTURED_PAYMENT_ERROR_CODES,
} from '@/features/payments/paymentsWorkspace.constants';
import i18n from '@/i18n';

export const getPayoffQuoteTotal = (payoffQuote) => Number(
  payoffQuote?.total
  ?? payoffQuote?.totalPayoffAmount
  ?? 0,
);

export const buildPaymentPayload = (loanId, amount) => ({
  loanId: Number(loanId),
  amount: Number(amount),
});

export const getOutstandingBalanceValue = (loan, fallbackBalance = 0) => {
  const snapshotBalance = Number(loan?.financialSnapshot?.outstandingBalance);
  if (Number.isFinite(snapshotBalance)) {
    return snapshotBalance;
  }

  const normalizedFallback = Number(fallbackBalance);
  return Number.isFinite(normalizedFallback) ? normalizedFallback : 0;
};

export const getOutstandingPrincipalValue = (loan, fallbackBalance = 0) => {
  const snapshotPrincipal = Number(loan?.financialSnapshot?.outstandingPrincipal ?? loan?.principalOutstanding);
  if (Number.isFinite(snapshotPrincipal)) {
    return snapshotPrincipal;
  }

  return getOutstandingBalanceValue(loan, fallbackBalance);
};

export const getFinancialBlockDetails = (loan) => {
  const source = loan?.financialBlock ?? loan?.financialSnapshot?.financialBlock;
  if (!source || typeof source !== 'object') {
    return null;
  }

  const isBlocked = source.isBlocked === true || source.active === true;
  if (!isBlocked) {
    return null;
  }

  return {
    code: source.code ? String(source.code) : null,
    message: source.message ? String(source.message) : i18n.t('payments.denialReasons.financialBlockMessage'),
    reason: source.reason ? String(source.reason) : null,
  };
};

export const getOverdueCalendarEntries = (calendar = []) => calendar.filter((entry) => (
  entry.status === 'overdue' && Number(entry.outstandingAmount || 0) > 0.01
));

export const dedupeDenialReasons = (reasons = []) => {
  const seen = new Set();

  return reasons.filter((reason) => {
    const key = [reason?.code, reason?.message, reason?.blockCode, reason?.blockReason].join('|');
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const formatDenialReason = (reason, action) => {
  const metadata = [
    reason?.blockCode ? i18n.t('payments.denialReasons.metadataCode', { value: reason.blockCode }) : null,
    reason?.blockReason ? i18n.t('payments.denialReasons.metadataReason', { value: reason.blockReason }) : null,
  ].filter(Boolean).join(' · ');

  switch (reason?.code) {
    case 'OVERDUE_UNPAID_INSTALLMENTS':
      return {
        key: `${action}-overdue`,
        title: i18n.t('payments.denialReasons.overdueTitle'),
        message: action === 'payoff'
          ? i18n.t('payments.denialReasons.overduePayoff')
          : i18n.t('payments.denialReasons.overdueCapital'),
        metadata,
      };
    case 'LOAN_ALREADY_PAID':
      return {
        key: `${action}-paid`,
        title: i18n.t('payments.denialReasons.paidTitle'),
        message: i18n.t('payments.denialReasons.paidMessage'),
        metadata,
      };
    case 'NO_OUTSTANDING_BALANCE':
      return {
        key: `${action}-no-balance`,
        title: i18n.t('payments.denialReasons.noBalanceTitle'),
        message: i18n.t('payments.denialReasons.noBalanceMessage'),
        metadata,
      };
    case 'FINANCIAL_BLOCK':
      return {
        key: `${action}-financial-block`,
        title: i18n.t('payments.denialReasons.financialBlockTitle'),
        message: reason?.message || i18n.t('payments.denialReasons.financialBlockMessage'),
        metadata,
      };
    case 'LOAN_NOT_PAYABLE_STATUS':
      return {
        key: `${action}-status`,
        title: i18n.t('payments.denialReasons.statusTitle'),
        message: reason?.message || i18n.t('payments.denialReasons.statusMessage'),
        metadata,
      };
    default:
      return {
        key: `${action}-${reason?.code || 'unknown'}`,
        title: i18n.t('payments.denialReasons.defaultTitle'),
        message: reason?.message || i18n.t('payments.denialReasons.defaultMessage'),
        metadata,
      };
  }
};

export const formatDenialReasons = (reasons = [], action) => dedupeDenialReasons(reasons).map((reason) => (
  formatDenialReason(reason, action)
));

export const getStructuredDenialReasons = (details, action) => {
  if (!details) {
    return [];
  }

  const expectedCode = action === 'payoff' ? 'PAYOFF_NOT_ALLOWED' : 'CAPITAL_PAYMENT_NOT_ALLOWED';
  const denialReasons = Array.isArray(details.denialReasons) ? details.denialReasons : [];

  if (denialReasons.length > 0) {
    return denialReasons;
  }

  if (details.code === expectedCode || STRUCTURED_PAYMENT_ERROR_CODES.has(details.code)) {
    return [{ code: details.code, message: details.message }];
  }

  return [];
};

export const buildClientEligibility = ({ action, loan, calendar, balance }) => {
  if (!loan) {
    return { allowed: true, denialReasons: [] };
  }

  const denialReasons = [];
  const outstandingBalance = getOutstandingBalanceValue(loan, balance);
  const outstandingPrincipal = getOutstandingPrincipalValue(loan, balance);
  const overdueEntries = getOverdueCalendarEntries(calendar);
  const financialBlock = getFinancialBlockDetails(loan);

  if (action === 'payoff' && (loan.status === 'closed' || loan.status === 'paid' || outstandingBalance <= 0.01)) {
    denialReasons.push({ code: 'LOAN_ALREADY_PAID' });
  }

  if (action === 'capital' && (outstandingBalance <= 0.01 || outstandingPrincipal <= 0.01)) {
    denialReasons.push({ code: 'NO_OUTSTANDING_BALANCE' });
  }

  if (overdueEntries.length > 0) {
    denialReasons.push({ code: 'OVERDUE_UNPAID_INSTALLMENTS' });
  }

  if (financialBlock) {
    denialReasons.push({
      code: 'FINANCIAL_BLOCK',
      message: financialBlock.message,
      blockCode: financialBlock.code,
      blockReason: financialBlock.reason,
    });
  }

  return {
    allowed: denialReasons.length === 0,
    denialReasons,
  };
};

export const buildEligibilityState = ({ action, clientEligibility, backendDetails, loading = false }) => {
  const backendReasons = getStructuredDenialReasons(backendDetails, action);
  if (backendReasons.length > 0) {
    return {
      status: 'blocked',
      source: 'backend',
      reasons: formatDenialReasons(backendReasons, action),
    };
  }

  if (!clientEligibility.allowed) {
    return {
      status: 'blocked',
      source: 'client',
      reasons: formatDenialReasons(clientEligibility.denialReasons, action),
    };
  }

  if (loading) {
    return {
      status: 'loading',
      source: 'backend',
      reasons: [],
    };
  }

  return {
    status: 'ready',
    source: 'client',
    reasons: [],
  };
};

export const buildEligibilityButtonTitle = (eligibilityState) => {
  if (!eligibilityState || eligibilityState.status !== 'blocked' || eligibilityState.reasons.length === 0) {
    return undefined;
  }

  return eligibilityState.reasons[0].message;
};

export const getLoanDetails = (loans, payments, loanId) => {
  const loan = loans.find((item) => item.id === parseInt(loanId, 10));
  if (!loan) return { emi: '', balance: '' };

  const financialSnapshot = loan.financialSnapshot || {};
  const snapshotInstallmentAmount = Number(financialSnapshot.installmentAmount ?? loan.installmentAmount);
  const snapshotOutstandingBalance = Number(financialSnapshot.outstandingBalance);

  if (Number.isFinite(snapshotInstallmentAmount) && Number.isFinite(snapshotOutstandingBalance)) {
    return {
      emi: snapshotInstallmentAmount.toFixed(2),
      balance: snapshotOutstandingBalance.toFixed(2),
    };
  }

  const principal = parseFloat(loan.amount);
  const rate = parseFloat(loan.interestRate) / 100 / 12;
  const n = parseInt(loan.termMonths, 10);
  const emi = rate === 0 ? principal / n : (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
  const paid = payments
    .filter((payment) => payment.loanId === loan.id)
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const totalDue = emi * n;
  const balance = Math.max(0, totalDue - paid);
  const finalBalance = balance < 1 ? 0 : balance;

  return { emi: emi.toFixed(2), balance: finalBalance.toFixed(2) };
};

export const formReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_LOAN':
      return { ...state, loanId: action.loanId, amount: action.amount };
    case 'SET_PAYMENT_TYPE':
      return { ...state, paymentType: action.paymentType };
    case 'SET_PAYOFF_DATE':
      return { ...state, payoffDate: action.payoffDate };
    case 'RESET':
      return {
        loanId: '',
        amount: '',
        paymentType: 'installment',
        payoffDate: new Date().toISOString().slice(0, 10),
      };
    default:
      return state;
  }
};

export const getEligibilityPanelCopy = (action) => {
  const config = PAYMENT_ACTION_CONFIG[action];

  return {
    actionLabel: i18n.t(config.actionLabel),
    blockedTitle: i18n.t(config.blockedTitle),
    readyTitle: i18n.t(config.readyTitle),
    helperText: i18n.t(config.helperText),
  };
};
