import { RECOVERY_STATUS_LABELS } from '@/features/loans/loansWorkspace.constants';
import i18n from '@/i18n';

export const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

export const formatDate = (value) => {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatLoanStatus = (status) => (status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : '-');
export const formatRecoveryStatus = (status) => {
  const translationKey = RECOVERY_STATUS_LABELS[status];
  return translationKey ? i18n.t(translationKey) : status || '-';
};

export const calculateSuggestedInterestRate = (amount, termMonths) => {
  const parsedAmount = Number(amount);
  const parsedTerm = Number(termMonths);

  if (!Number.isFinite(parsedAmount) || !Number.isFinite(parsedTerm) || parsedAmount <= 0 || parsedTerm <= 0) {
    return '';
  }

  let rate = 2.5;

  if (parsedAmount >= 10000) rate -= 0.5;
  if (parsedAmount >= 20000) rate -= 0.3;
  if (parsedTerm >= 12) rate -= 0.3;

  return Math.max(1.5, Math.min(rate, 3.5)).toFixed(1);
};

export const getLoanDetails = (loan, payments) => {
  if (!loan) return { emi: '0.00', balance: '0.00', totalDue: 0 };

  const financialSnapshot = loan.financialSnapshot || {};
  const snapshotInstallmentAmount = Number(financialSnapshot.installmentAmount ?? loan.installmentAmount);
  const snapshotOutstandingBalance = Number(financialSnapshot.outstandingBalance);
  const snapshotTotalPayable = Number(financialSnapshot.totalPayable ?? loan.totalPayable);

  const principal = Number(loan.amount || 0);
  const rate = Number(loan.interestRate || 0) / 100 / 12;
  const totalInstallments = Number(loan.termMonths || 0);

  if (Number.isFinite(snapshotInstallmentAmount) && Number.isFinite(snapshotOutstandingBalance) && Number.isFinite(snapshotTotalPayable)) {
    return {
      emi: snapshotInstallmentAmount.toFixed(2),
      balance: snapshotOutstandingBalance.toFixed(2),
      totalDue: snapshotTotalPayable,
    };
  }

  if (!principal || !totalInstallments) {
    return { emi: '0.00', balance: '0.00', totalDue: 0 };
  }

  const emi = rate === 0
    ? principal / totalInstallments
    : (principal * rate * Math.pow(1 + rate, totalInstallments)) / (Math.pow(1 + rate, totalInstallments) - 1);

  const totalPaid = (payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalDue = emi * totalInstallments;
  const balance = Math.max(0, totalDue - totalPaid);

  return {
    emi: emi.toFixed(2),
    balance: balance < 1 ? '0.00' : balance.toFixed(2),
    totalDue,
  };
};

export const getQueryArrayData = (query, selector, fallback = []) => {
  if (!query?.data) return fallback;
  const value = selector(query.data);
  return Array.isArray(value) ? value : fallback;
};

export const mapQueriesById = (ids, queries, selector) => ids.reduce((result, id, index) => {
  result[id] = getQueryArrayData(queries[index], selector, []);
  return result;
}, {});

export const getFirstQueryError = (queries) => queries.find((query) => query?.error)?.error || null;
