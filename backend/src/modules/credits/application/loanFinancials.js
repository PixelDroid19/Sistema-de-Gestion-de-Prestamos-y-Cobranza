const { ValidationError } = require('@/utils/errorHandler');
const { summarizeSchedule, buildAmortizationSchedule, roundCurrency } = require('./creditFormulaHelpers');
const { assertPayoffAllowed } = require('./paymentEligibility');
const { buildDateFormatMessage, normalizeDateOnly } = require('@/modules/shared/dateUtils');
const { calculateLateFee } = require('../domain/calculation/lateFeeCalculator');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOAN_NOT_PAYABLE_PAYOFF_MESSAGE = 'El crédito no tiene saldo pendiente para pago total.';

const formatUtcDateOnly = (value) => {
  const date = normalizeUtcDateOnly(value);
  return date.toISOString().slice(0, 10);
};

const normalizeUtcDateOnly = (value, field = 'date') => {
  try {
    return normalizeDateOnly(value, field);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(buildDateFormatMessage(field));
  }
};

const resolveLoanStartDateValue = (loan) => (
  loan?.startDate
  || loan?.financialSnapshot?.startDate
  || loan?.createdAt
  || loan?.updatedAt
);

const resolveLoanCalculationMethod = (loan) => (
  loan?.calculationMethod
  || loan?.financialSnapshot?.calculationMethod
  || undefined
);

const countElapsedAccrualDays = ({ anchorDate, asOfDate }) => {
  const diffMs = asOfDate.getTime() - anchorDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.round(diffMs / MS_PER_DAY);
};

const extractOverdueBuckets = ({ loan = {}, schedule, asOfDate }) => schedule.reduce((summary, row) => {
  const dueDate = normalizeUtcDateOnly(row.dueDate, 'Schedule due date');
  if (dueDate.getTime() > asOfDate.getTime()) {
    return summary;
  }

  summary.overduePrincipal = roundCurrency(summary.overduePrincipal + Number(row.remainingPrincipal || 0));
  summary.overdueInterest = roundCurrency(summary.overdueInterest + Number(row.remainingInterest || 0));
  const daysOverdue = Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / MS_PER_DAY));
  const remainingInterest = roundCurrency(row.remainingInterest || 0);
  const remainingInstallment = roundCurrency((row.remainingPrincipal || 0) + remainingInterest);
  summary.lateFee = roundCurrency(summary.lateFee + calculateLateFee({
    overdueAmount: remainingInterest > 0 ? remainingInterest : remainingInstallment,
    daysOverdue,
    feeMode: String(loan.lateFeeMode || 'NONE').toUpperCase(),
    annualRate: Number(loan.annualLateFeeRate || 0),
  }));
  return summary;
}, {
  overduePrincipal: 0,
  overdueInterest: 0,
  lateFee: 0,
});

const resolveAccrualAnchor = ({ loan, schedule, asOfDate }) => {
  const latestDueRow = [...schedule]
    .filter((row) => normalizeUtcDateOnly(row.dueDate, 'Schedule due date').getTime() <= asOfDate.getTime())
    .sort((left, right) => new Date(right.dueDate) - new Date(left.dueDate))[0] || null;

  if (latestDueRow) {
    return {
      source: 'schedule_due_date',
      date: normalizeUtcDateOnly(latestDueRow.dueDate, 'Schedule due date'),
    };
  }

  return {
    source: 'loan_start_date',
    date: normalizeUtcDateOnly(resolveLoanStartDateValue(loan), 'Loan start date'),
  };
};

const buildPayoffQuote = ({ loan, schedule, snapshot, asOfDate }) => {
  const normalizedAsOfDate = normalizeUtcDateOnly(asOfDate, 'asOfDate');
  const normalizedStartDate = normalizeUtcDateOnly(resolveLoanStartDateValue(loan), 'Loan start date');

  if (normalizedAsOfDate.getTime() < normalizedStartDate.getTime()) {
    throw new ValidationError('La fecha efectiva del pago total debe ser igual o posterior al inicio del crédito');
  }

  assertPayoffAllowed({
    loan,
    schedule,
    snapshot,
    asOfDate: normalizedAsOfDate,
  });

  const overdue = extractOverdueBuckets({ loan, schedule, asOfDate: normalizedAsOfDate });
  const outstandingPrincipal = roundCurrency(snapshot.outstandingPrincipal || 0);
  const futurePrincipal = roundCurrency(Math.max(0, outstandingPrincipal - overdue.overduePrincipal));
  const accrualAnchor = resolveAccrualAnchor({ loan, schedule, asOfDate: normalizedAsOfDate });
  const accruedDays = countElapsedAccrualDays({ anchorDate: accrualAnchor.date, asOfDate: normalizedAsOfDate });
  const accruedInterest = roundCurrency(
    futurePrincipal * (Number(loan.interestRate || 0) / 100) * (accruedDays / 365),
  );
  const total = roundCurrency(
    overdue.overduePrincipal
    + overdue.overdueInterest
    + overdue.lateFee
    + futurePrincipal
    + accruedInterest,
  );

  if (total <= 0.01) {
    throw new ValidationError(LOAN_NOT_PAYABLE_PAYOFF_MESSAGE);
  }

  return {
    asOfDate: formatUtcDateOnly(normalizedAsOfDate),
    accrualMethod: 'actual/365',
    accruedDays,
    accrualAnchor: {
      source: accrualAnchor.source,
      date: formatUtcDateOnly(accrualAnchor.date),
    },
    outstandingPrincipal,
    breakdown: {
      lateFee: overdue.lateFee,
      overduePrincipal: overdue.overduePrincipal,
      overdueInterest: overdue.overdueInterest,
      accruedInterest,
      futurePrincipal,
    },
    total,
  };
};

/**
 * Build the persisted loan snapshot from a canonical amortization schedule.
 * @param {Array<object>} schedule
 * @returns {object}
 */
const buildFinancialSnapshot = (schedule) => summarizeSchedule(schedule);

/**
 * Return the canonical schedule and financial snapshot for persisted loan records.
 * @param {object} loan
 * @returns {{ schedule: Array<object>, snapshot: object }}
 */
const getCanonicalLoanView = (loan) => {
  const existingSchedule = Array.isArray(loan.emiSchedule) && loan.emiSchedule.length > 0
    ? loan.emiSchedule
    : buildAmortizationSchedule({
      amount: loan.amount,
      interestRate: loan.interestRate,
      termMonths: loan.termMonths,
      startDate: resolveLoanStartDateValue(loan) || new Date(),
      calculationMethod: resolveLoanCalculationMethod(loan),
    });

  const rebuiltSnapshot = buildFinancialSnapshot(existingSchedule);
  const existingSnapshot = loan.financialSnapshot && Object.keys(loan.financialSnapshot).length > 0
    ? loan.financialSnapshot
    : {};
  const inferredCapitalAdjustments = roundCurrency(Math.max(
    0,
    Number(loan.amount || 0) - Number(rebuiltSnapshot.totalPrincipal || 0)
  ));
  const existingCapitalAdjustments = roundCurrency(existingSnapshot.capitalAdjustmentsApplied || 0);
  const capitalAdjustmentsApplied = existingCapitalAdjustments > 0
    ? existingCapitalAdjustments
    : inferredCapitalAdjustments;
  const snapshot = {
    ...existingSnapshot,
    ...rebuiltSnapshot,
  };

  if (capitalAdjustmentsApplied > 0) {
    snapshot.capitalAdjustmentsApplied = capitalAdjustmentsApplied;
    snapshot.totalPrincipal = roundCurrency((rebuiltSnapshot.totalPrincipal || 0) + capitalAdjustmentsApplied);
    snapshot.totalPaidPrincipal = roundCurrency((rebuiltSnapshot.totalPaidPrincipal || 0) + capitalAdjustmentsApplied);
    snapshot.totalPaid = roundCurrency((snapshot.totalPaidPrincipal || 0) + (snapshot.totalPaidInterest || 0));
    snapshot.totalPayable = roundCurrency((snapshot.totalPaid || 0) + (snapshot.outstandingBalance || 0));
  }

  const totalPaidPenalty = roundCurrency(existingSnapshot.totalPaidPenalty || 0);
  const totalPaidAccruedInterest = roundCurrency(existingSnapshot.totalPaidAccruedInterest || 0);
  if (totalPaidPenalty > 0 || totalPaidAccruedInterest > 0) {
    snapshot.totalPaidPenalty = totalPaidPenalty;
    snapshot.totalPaidAccruedInterest = totalPaidAccruedInterest;
    snapshot.totalPaidInterest = roundCurrency(
      Number(rebuiltSnapshot.totalPaidInterest || 0) + totalPaidAccruedInterest,
    );
    snapshot.totalPaid = roundCurrency(
      Number(snapshot.totalPaidPrincipal || 0) + snapshot.totalPaidInterest + totalPaidPenalty,
    );
    snapshot.totalPayable = roundCurrency(
      snapshot.totalPaid + Number(snapshot.outstandingBalance || 0),
    );
  }

  return {
    schedule: existingSchedule,
    snapshot,
  };
};

/**
 * Create the loan read-model service shared across payment and reporting flows.
 * @returns {{ getCanonicalLoanView: Function, getSnapshot: Function }}
 */
const createLoanViewService = () => ({
  getCanonicalLoanView,
  getSnapshot(loan) {
    return getCanonicalLoanView(loan).snapshot;
  },
  getPayoffQuote(loan, asOfDate) {
    const { schedule, snapshot } = getCanonicalLoanView(loan);
    return buildPayoffQuote({ loan, schedule, snapshot, asOfDate });
  },
});

module.exports = {
  buildFinancialSnapshot,
  buildPayoffQuote,
  countElapsedAccrualDays,
  extractOverdueBuckets,
  formatUtcDateOnly,
  getCanonicalLoanView,
  normalizeUtcDateOnly,
  resolveAccrualAnchor,
  createLoanViewService,
};
