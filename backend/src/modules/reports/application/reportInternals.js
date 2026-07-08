/**
 * Internal utility functions for report generation.
 *
 * These helpers handle output formatting (PDF, CSV), data presentation,
 * and report-specific calculations. They are NOT business use cases —
 * they are infrastructure for the reporting layer.
 *
 * @module reports/application/reportInternals
 */

const { formatCurrency } = require('@/modules/shared/money');
const { buildPaginationMeta, paginateArray } = require('@/modules/shared/pagination');
const { toDateOnlyOrNull } = require('@/modules/shared/dateUtils');
const { deriveLoanOverdueSnapshot } = require('@/modules/credits/application/useCases');
const { MONEY_FORMAT } = require('@/modules/reports/application/excelExportFormats');
const { buildCsv } = require('@/modules/reports/application/reportHelpers');

// ─── Date Formatting ────────────────────────────────────────────────────────

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }
  return toDateOnlyOrNull(value) || 'N/A';
};

// ─── Excel Column Helpers ───────────────────────────────────────────────────

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: MONEY_FORMAT });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: 'dd/mm/yyyy' });

// ─── Monthly Performance ────────────────────────────────────────────────────

const toMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildMonthKeysInRange = ({ startDate, endDate }) => {
  const keys = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
};

const pickLoanDisbursementDate = (loan) => (
  loan?.disbursedAt
  || loan?.disbursementDate
  || loan?.approvedAt
  || loan?.startDate
  || loan?.createdAt
);

const buildMonthlyPerformanceSeries = ({ loans = [], payments = [], minMonths = 12 }) => {
  const now = new Date();
  const activityDates = [];

  loans.forEach((loan) => {
    const rawDate = pickLoanDisbursementDate(loan);
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    activityDates.push(date);
  });

  payments
    .filter((payment) => !payment?.status || payment.status === 'completed')
    .forEach((payment) => {
      const rawDate = payment?.paymentDate || payment?.createdAt;
      if (!rawDate) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      activityDates.push(date);
    });

  const rollingStart = new Date(now.getFullYear(), now.getMonth() - (minMonths - 1), 1);
  const earliestActivity = activityDates.length > 0
    ? activityDates.reduce((earliest, date) => (date.getTime() < earliest.getTime() ? date : earliest), activityDates[0])
    : null;

  const startDate = earliestActivity
    ? new Date(Math.min(rollingStart.getTime(), new Date(earliestActivity.getFullYear(), earliestActivity.getMonth(), 1).getTime()))
    : rollingStart;

  const monthKeys = buildMonthKeysInRange({ startDate, endDate: now });
  const monthsSet = new Set(monthKeys);
  const disbursedByMonth = {};
  const recoveredByMonth = {};

  loans.forEach((loan) => {
    const rawDate = pickLoanDisbursementDate(loan);
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const key = toMonthKey(date);
    if (!monthsSet.has(key)) return;
    disbursedByMonth[key] = (disbursedByMonth[key] || 0) + Number(loan?.amount || 0);
  });

  payments
    .filter((payment) => !payment?.status || payment.status === 'completed')
    .forEach((payment) => {
      const rawDate = payment?.paymentDate || payment?.createdAt;
      if (!rawDate) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      const key = toMonthKey(date);
      if (!monthsSet.has(key)) return;
      recoveredByMonth[key] = (recoveredByMonth[key] || 0) + Number(payment?.amount || 0);
    });

  return monthKeys.map((month) => ({
    month,
    disbursed: Number((disbursedByMonth[month] || 0).toFixed(2)),
    recovered: Number((recoveredByMonth[month] || 0).toFixed(2)),
  }));
};

// ─── Customer History Timeline ──────────────────────────────────────────────

const buildCustomerHistoryTimeline = (history) => ([
  ...(history.loans || []).map((loan) => ({
    id: `loan-${loan.id}`,
    entityId: loan.id,
    entityType: 'loan',
    eventType: `loan_${loan.status}`,
    occurredAt: loan.updatedAt || loan.createdAt,
    data: loan,
  })),
  ...(history.payments || []).map((payment) => ({
    id: `payment-${payment.id}`,
    entityId: payment.id,
    entityType: 'payment',
    eventType: `payment_${payment.status}`,
    occurredAt: payment.paymentDate || payment.createdAt,
    data: payment,
  })),
  ...(history.documents || []).map((document) => ({
    id: `document-${document.id}`,
    entityId: document.id,
    entityType: 'document',
    eventType: 'document_uploaded',
    occurredAt: document.createdAt,
    data: document,
  })),
  ...(history.alerts || []).map((alert) => ({
    id: `alert-${alert.id}`,
    entityId: alert.id,
    entityType: 'alert',
    eventType: `alert_${alert.status}`,
    occurredAt: alert.updatedAt || alert.createdAt,
    data: alert,
  })),
  ...(history.promises || []).map((promise) => ({
    id: `promise-${promise.id}`,
    entityId: promise.id,
    entityType: 'promise',
    eventType: `promise_${promise.status}`,
    occurredAt: promise.lastStatusChangedAt || promise.createdAt,
    data: promise,
  })),
  ...(history.notifications || []).map((notification) => ({
    id: `notification-${notification.id}`,
    entityId: notification.id,
    entityType: 'notification',
    eventType: notification.type,
    occurredAt: notification.createdAt,
    data: notification,
  })),
]).sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));

// ─── Profitability Helpers ──────────────────────────────────────────────────

const RECOVERY_BALANCE_TOLERANCE = 0.01;
const PROFITABILITY_PAYMENT_STATUSES = new Set(['completed']);
const PROFITABILITY_ACTIVE_LOAN_STATUSES = new Set(['approved', 'active', 'overdue', 'defaulted']);
const PROFITABILITY_CLOSED_LOAN_STATUSES = new Set(['closed', 'paid']);
const PROFITABILITY_OVERDUE_STATUSES = new Set(['overdue', 'defaulted', 'late', 'delinquent']);

const getProfitabilityLoanRiskSignals = (row) => {
  const loanStatus = String(row.loanStatus || '').toLowerCase();
  const recoveryStatus = String(row.recoveryStatus || '').toLowerCase();
  const outstandingBalance = Number(row.outstandingBalance || 0);
  const paymentCount = Number(row.paymentCount || 0);
  const penaltyCollected = Number(row.penaltyCollected || 0);
  // Overdue is read from the persisted collection state OR derived live from the schedule
  // (same logic as the credits list/calendar), so profitability risk signals no longer
  // miss loans whose installments lapsed without a manual status change. Recovered loans
  // are settled and never re-flagged from a stale snapshot.
  const isOverdue = PROFITABILITY_OVERDUE_STATUSES.has(loanStatus)
    || PROFITABILITY_OVERDUE_STATUSES.has(recoveryStatus)
    || (recoveryStatus !== 'recovered' && Boolean(row.derivedOverdue));

  return {
    loanStatus,
    recoveryStatus,
    outstandingBalance,
    paymentCount,
    penaltyCollected,
    isActive: PROFITABILITY_ACTIVE_LOAN_STATUSES.has(loanStatus),
    isClosed: PROFITABILITY_CLOSED_LOAN_STATUSES.has(loanStatus) || outstandingBalance <= RECOVERY_BALANCE_TOLERANCE,
    isOverdue,
    hasOutstandingWithoutPayments: outstandingBalance > RECOVERY_BALANCE_TOLERANCE && paymentCount === 0,
  };
};

const resolveCustomerRiskLevel = ({ overdueLoanCount, defaultedLoanCount, outstandingBalance, loanCount, paymentCount }) => {
  if (defaultedLoanCount > 0 || overdueLoanCount > 1) {
    return 'high';
  }

  if (overdueLoanCount > 0 || (outstandingBalance > RECOVERY_BALANCE_TOLERANCE && paymentCount === 0 && loanCount > 0)) {
    return 'medium';
  }

  return 'low';
};

const resolveCustomerPaymentBehavior = ({ overdueLoanCount, defaultedLoanCount, paymentCount, outstandingBalance }) => {
  if (defaultedLoanCount > 0) {
    return 'critical';
  }

  if (overdueLoanCount > 0) {
    return 'delinquent';
  }

  if (paymentCount === 0 && outstandingBalance > RECOVERY_BALANCE_TOLERANCE) {
    return 'without_payments';
  }

  return 'current';
};

const buildProfitabilityLoanRows = ({ loans, payments }) => {
  const paymentsByLoan = payments.reduce((map, payment) => {
    const key = Number(payment.loanId);
    const current = map.get(key) || [];
    current.push(payment);
    map.set(key, current);
    return map;
  }, new Map());

  return loans.map((loan) => {
    const loanPayments = (paymentsByLoan.get(Number(loan.id)) || [])
      .filter((payment) => PROFITABILITY_PAYMENT_STATUSES.has(payment.status));
    const totalCollected = loanPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const principalCollected = loanPayments.reduce((sum, payment) => sum + Number(payment.principalApplied || 0), 0);
    const interestCollected = loanPayments.reduce((sum, payment) => sum + Number(payment.interestApplied || 0), 0);
    const penaltyCollected = loanPayments.reduce((sum, payment) => sum + Number(payment.penaltyApplied || 0), 0);
    const totalProfit = interestCollected + penaltyCollected;
    const outstandingBalance = loan.financialSnapshot?.outstandingBalance
      ?? loan.remainingBalanceAfterPayment
      ?? 0;
    const latestPaymentDate = loanPayments
      .map((payment) => payment.paymentDate)
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;
    const overdueSnapshot = deriveLoanOverdueSnapshot(loan);

    return {
      loanId: loan.id,
      customerId: loan.customerId,
      customerName: loan.Customer?.name || null,
      loanStatus: loan.status,
      recoveryStatus: loan.recoveryStatus || null,
      derivedOverdue: overdueSnapshot.isOverdue,
      daysOverdue: overdueSnapshot.daysOverdue,
      originatedAmount: formatCurrency(loan.amount || 0),
      totalCollected: formatCurrency(totalCollected),
      principalCollected: formatCurrency(principalCollected),
      interestCollected: formatCurrency(interestCollected),
      penaltyCollected: formatCurrency(penaltyCollected),
      totalProfit: formatCurrency(totalProfit),
      outstandingBalance: formatCurrency(outstandingBalance),
      paymentCount: loanPayments.length,
      lastPaymentDate: latestPaymentDate,
      profitable: totalProfit > 0,
    };
  });
};

const buildProfitabilitySummary = (rows) => ({
  totalOriginatedAmount: formatCurrency(rows.reduce((sum, row) => sum + Number(row.originatedAmount || 0), 0)),
  totalCollected: formatCurrency(rows.reduce((sum, row) => sum + Number(row.totalCollected || 0), 0)),
  totalProfit: formatCurrency(rows.reduce((sum, row) => sum + Number(row.totalProfit || 0), 0)),
  totalOutstandingBalance: formatCurrency(rows.reduce((sum, row) => sum + Number(row.outstandingBalance || 0), 0)),
});

const buildCustomerProfitabilityRows = (loanRows) => {
  const grouped = loanRows.reduce((map, row) => {
    const current = map.get(Number(row.customerId)) || {
      customerId: row.customerId,
      customerName: row.customerName,
      loanCount: 0,
      originatedAmount: 0,
      totalCollected: 0,
      principalCollected: 0,
      interestCollected: 0,
      penaltyCollected: 0,
      totalProfit: 0,
      outstandingBalance: 0,
      profitableLoanCount: 0,
      activeLoanCount: 0,
      closedLoanCount: 0,
      overdueLoanCount: 0,
      defaultedLoanCount: 0,
      paymentCount: 0,
      penaltyEventCount: 0,
      lastPaymentDate: null,
    };
    const signals = getProfitabilityLoanRiskSignals(row);

    current.loanCount += 1;
    current.originatedAmount += Number(row.originatedAmount || 0);
    current.totalCollected += Number(row.totalCollected || 0);
    current.principalCollected += Number(row.principalCollected || 0);
    current.interestCollected += Number(row.interestCollected || 0);
    current.penaltyCollected += Number(row.penaltyCollected || 0);
    current.totalProfit += Number(row.totalProfit || 0);
    current.outstandingBalance += Number(row.outstandingBalance || 0);
    current.profitableLoanCount += row.profitable ? 1 : 0;
    current.activeLoanCount += signals.isActive ? 1 : 0;
    current.closedLoanCount += signals.isClosed ? 1 : 0;
    current.overdueLoanCount += signals.isOverdue ? 1 : 0;
    current.defaultedLoanCount += signals.loanStatus === 'defaulted' || signals.recoveryStatus === 'defaulted' ? 1 : 0;
    current.paymentCount += signals.paymentCount;
    current.penaltyEventCount += signals.penaltyCollected > 0 ? 1 : 0;
    if (row.lastPaymentDate && (!current.lastPaymentDate || new Date(row.lastPaymentDate) > new Date(current.lastPaymentDate))) {
      current.lastPaymentDate = row.lastPaymentDate;
    }
    map.set(Number(row.customerId), current);
    return map;
  }, new Map());

  return Array.from(grouped.values()).map((row) => {
    const riskLevel = resolveCustomerRiskLevel(row);
    const paymentBehavior = resolveCustomerPaymentBehavior(row);

    return {
      ...row,
      riskLevel,
      paymentBehavior,
      isDelinquent: row.overdueLoanCount > 0 || row.defaultedLoanCount > 0,
      originatedAmount: formatCurrency(row.originatedAmount),
      totalCollected: formatCurrency(row.totalCollected),
      principalCollected: formatCurrency(row.principalCollected),
      interestCollected: formatCurrency(row.interestCollected),
      penaltyCollected: formatCurrency(row.penaltyCollected),
      totalProfit: formatCurrency(row.totalProfit),
      outstandingBalance: formatCurrency(row.outstandingBalance),
    };
  });
};

const buildCustomerProfitabilityAnalytics = (customerRows) => {
  const sortByNumber = (key) => [...customerRows].sort((left, right) => Number(right[key] || 0) - Number(left[key] || 0));
  const delinquentCustomers = customerRows.filter((row) => row.isDelinquent);

  return {
    topByLoanCount: sortByNumber('loanCount').slice(0, 5),
    topByOutstandingBalance: sortByNumber('outstandingBalance').filter((row) => Number(row.outstandingBalance || 0) > 0).slice(0, 5),
    delinquentCustomers: delinquentCustomers.slice(0, 5),
    summary: {
      customerCount: customerRows.length,
      delinquentCustomerCount: delinquentCustomers.length,
      highRiskCustomerCount: customerRows.filter((row) => row.riskLevel === 'high').length,
      mediumRiskCustomerCount: customerRows.filter((row) => row.riskLevel === 'medium').length,
      lowRiskCustomerCount: customerRows.filter((row) => row.riskLevel === 'low').length,
    },
  };
};

const buildProfitabilitySummaryFromDataset = ({ loans = [], payments = [] }) => {
  const loanRows = buildProfitabilityLoanRows({ loans, payments });
  const customerRows = buildCustomerProfitabilityRows(loanRows);
  return {
    ...buildProfitabilitySummary(loanRows),
    customerAnalytics: buildCustomerProfitabilityAnalytics(customerRows),
  };
};

// ─── Servicing Notes ────────────────────────────────────────────────────────

const buildServicingNotes = ({ alerts = [], promises = [] }) => {
  const noteEntries = [];

  alerts.forEach((alert) => {
    if (alert.notes) {
      noteEntries.push({
        id: `alert-note-${alert.id}`,
        entityType: 'alert',
        entityId: alert.id,
        note: alert.notes,
        occurredAt: alert.updatedAt || alert.createdAt,
      });
    }
  });

  promises.forEach((promise) => {
    if (promise.notes) {
      noteEntries.push({
        id: `promise-note-${promise.id}`,
        entityType: 'promise',
        entityId: promise.id,
        note: promise.notes,
        occurredAt: promise.lastStatusChangedAt || promise.createdAt,
      });
    }

    (Array.isArray(promise.statusHistory) ? promise.statusHistory : []).forEach((entry, index) => {
      if (entry?.note || entry?.reason) {
        noteEntries.push({
          id: `promise-history-${promise.id}-${index}`,
          entityType: 'promise',
          entityId: promise.id,
          note: entry.note || entry.reason,
          status: entry.status,
          occurredAt: entry.changedAt || promise.lastStatusChangedAt || promise.createdAt,
        });
      }
    });
  });

  return noteEntries
    .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))
    .slice(0, 10);
};

// ─── Recovery Bucket Logic ──────────────────────────────────────────────────

const getRecoveryBucket = ({ loan, snapshot }) => {
  const outstandingBalance = parseFloat(snapshot.outstandingBalance || 0);

  if (loan.status === 'closed' || outstandingBalance <= RECOVERY_BALANCE_TOLERANCE) {
    return 'recovered';
  }

  return 'outstanding';
};

// ─── Loan Report Records ────────────────────────────────────────────────────

/**
 * Build a report-ready loan row using canonical balance state and payment history.
 * @param {{ loan: object, paymentRepository: object, loanViewService: object }} deps
 * @returns {Promise<object>}
 */
const buildLoanReportRecord = async ({ loan, paymentRepository, loanViewService }) => {
  const payments = await paymentRepository.listByLoan(loan.id);
  const snapshot = loanViewService.getSnapshot(loan);
  const serializedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;
  const completedPayments = payments.filter((payment) => !payment?.status || payment.status === 'completed');
  const totalInterestPaid = completedPayments.reduce((sum, payment) => sum + Number(payment?.interestApplied || 0), 0);
  // Live overdue snapshot derived from the canonical schedule (same source as the
  // credits list/calendar and profitability risk signals), so dashboard delinquency
  // never relies on stale alert state.
  const derivedOverdue = deriveLoanOverdueSnapshot(serializedLoan).isOverdue;
  const loanStatus = String(serializedLoan.status || '').toLowerCase();
  const recoveryStatus = String(serializedLoan.recoveryStatus || '').toLowerCase();
  const isOverdue = recoveryStatus !== 'recovered'
    && (PROFITABILITY_OVERDUE_STATUSES.has(loanStatus) || derivedOverdue);

  return {
    ...serializedLoan,
    derivedOverdue,
    isOverdue,
    totalPaid: snapshot.totalPaid.toFixed(2),
    totalPrincipalRecovered: Number(snapshot.totalPaidPrincipal || 0).toFixed(2),
    totalDue: snapshot.totalPayable.toFixed(2),
    totalInterestGenerated: Number(snapshot.totalInterest || 0).toFixed(2),
    totalInterestPaid: Number(snapshot.totalPaidInterest ?? totalInterestPaid).toFixed(2),
    outstandingAmount: snapshot.outstandingBalance.toFixed(2),
    outstandingPrincipalAmount: Number(snapshot.outstandingPrincipal || 0).toFixed(2),
    emi: snapshot.installmentAmount.toFixed(2),
    paymentCount: payments.length,
    lastPaymentDate: loan.lastPaymentDate || (payments.length > 0 ? payments[payments.length - 1].paymentDate : null),
    nextInstallment: snapshot.nextInstallment,
    recoveryBucket: getRecoveryBucket({ loan: serializedLoan, snapshot }),
  };
};

const buildLoansWithDetails = async ({ loans, paymentRepository, loanViewService }) => Promise.all(
  loans.map((loan) => buildLoanReportRecord({ loan, paymentRepository, loanViewService })),
);

// ─── Pagination ─────────────────────────────────────────────────────────────

const paginateCollection = (items, pagination) => {
  if (!pagination) {
    return { items, pagination: null };
  }

  const normalized = paginateArray({ items, pagination: { ...pagination, offset: 0 } });
  return {
    items: normalized.items,
    pagination: buildPaginationMeta({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
    }),
  };
};

module.exports = {
  buildCsv,
  formatIsoDate,
  moneyColumn,
  dateColumn,
  toMonthKey,
  buildMonthKeysInRange,
  pickLoanDisbursementDate,
  buildMonthlyPerformanceSeries,
  buildCustomerHistoryTimeline,
  RECOVERY_BALANCE_TOLERANCE,
  PROFITABILITY_PAYMENT_STATUSES,
  buildProfitabilityLoanRows,
  buildProfitabilitySummary,
  buildCustomerProfitabilityRows,
  buildCustomerProfitabilityAnalytics,
  buildProfitabilitySummaryFromDataset,
  buildServicingNotes,
  getRecoveryBucket,
  buildLoanReportRecord,
  buildLoansWithDetails,
  deriveLoanOverdueSnapshot,
  paginateCollection,
};
