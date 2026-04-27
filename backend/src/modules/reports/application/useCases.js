const XLSX = require('xlsx');
const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const { normalizeDistributionRecord } = require('@/modules/associates/application/useCases');
const { buildPaginationMeta, paginateArray } = require('@/modules/shared/pagination');
const {
  ensureAdmin,
  formatMoney,
  parseDateRange,
} = require('./reportHelpers');

const normalizeParticipationPercentage = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number(value).toFixed(4);
};

const normalizeAssociateRecord = (associate) => {
  const serializedAssociate = typeof associate?.toJSON === 'function' ? associate.toJSON() : associate;

  return {
    ...serializedAssociate,
    participationPercentage: normalizeParticipationPercentage(serializedAssociate?.participationPercentage),
  };
};

const buildCsv = ({ headers, rows }) => {
  const escapeCell = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replaceAll('"', '""')}"`;
    }
    return stringValue;
  };

  return [headers.join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\n');
};

const escapePdfText = (value) => String(value)
  .replaceAll('\\', '\\\\')
  .replaceAll('(', '\\(')
  .replaceAll(')', '\\)');

const buildPdfTextStream = ({ title, lines }) => {
  const commands = [
    'BT',
    '/F1 18 Tf',
    '50 780 Td',
    `(${escapePdfText(title)}) Tj`,
    '0 -28 Td',
    '/F1 12 Tf',
  ];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('0 -18 Td');
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
};

const buildPdfBuffer = ({ title, lines }) => {
  const contentStream = buildPdfTextStream({ title, lines });
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const buildWorkbookBuffer = (sheets) => {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
  });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const RECOVERY_BALANCE_TOLERANCE = 0.01;

const PROFITABILITY_PAYMENT_STATUSES = new Set(['completed']);

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

  const monthKeys = buildMonthKeysInRange({
    startDate,
    endDate: now,
  });
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

    return {
      loanId: loan.id,
      customerId: loan.customerId,
      customerName: loan.Customer?.name || null,
      loanStatus: loan.status,
      recoveryStatus: loan.recoveryStatus || null,
      originatedAmount: formatMoney(loan.amount || 0),
      totalCollected: formatMoney(totalCollected),
      principalCollected: formatMoney(principalCollected),
      interestCollected: formatMoney(interestCollected),
      penaltyCollected: formatMoney(penaltyCollected),
      totalProfit: formatMoney(totalProfit),
      outstandingBalance: formatMoney(outstandingBalance),
      paymentCount: loanPayments.length,
      lastPaymentDate: loanPayments[0]?.paymentDate || null,
      profitable: totalProfit > 0,
    };
  });
};

const buildProfitabilitySummary = (rows) => ({
  totalOriginatedAmount: formatMoney(rows.reduce((sum, row) => sum + Number(row.originatedAmount || 0), 0)),
  totalCollected: formatMoney(rows.reduce((sum, row) => sum + Number(row.totalCollected || 0), 0)),
  totalProfit: formatMoney(rows.reduce((sum, row) => sum + Number(row.totalProfit || 0), 0)),
  totalOutstandingBalance: formatMoney(rows.reduce((sum, row) => sum + Number(row.outstandingBalance || 0), 0)),
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
    };

    current.loanCount += 1;
    current.originatedAmount += Number(row.originatedAmount || 0);
    current.totalCollected += Number(row.totalCollected || 0);
    current.principalCollected += Number(row.principalCollected || 0);
    current.interestCollected += Number(row.interestCollected || 0);
    current.penaltyCollected += Number(row.penaltyCollected || 0);
    current.totalProfit += Number(row.totalProfit || 0);
    current.outstandingBalance += Number(row.outstandingBalance || 0);
    current.profitableLoanCount += row.profitable ? 1 : 0;
    map.set(Number(row.customerId), current);
    return map;
  }, new Map());

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    originatedAmount: formatMoney(row.originatedAmount),
    totalCollected: formatMoney(row.totalCollected),
    principalCollected: formatMoney(row.principalCollected),
    interestCollected: formatMoney(row.interestCollected),
    penaltyCollected: formatMoney(row.penaltyCollected),
    totalProfit: formatMoney(row.totalProfit),
    outstandingBalance: formatMoney(row.outstandingBalance),
  }));
};

const buildProfitabilitySummaryFromDataset = ({ loans = [], payments = [] }) => {
  const loanRows = buildProfitabilityLoanRows({ loans, payments });
  return buildProfitabilitySummary(loanRows);
};

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

const getRecoveryBucket = ({ loan, snapshot }) => {
  const outstandingBalance = parseFloat(snapshot.outstandingBalance || 0);

  if (loan.status === 'closed' || outstandingBalance <= RECOVERY_BALANCE_TOLERANCE) {
    return 'recovered';
  }

  if (outstandingBalance > RECOVERY_BALANCE_TOLERANCE) {
    return 'outstanding';
  }

  return 'ignored';
};

/**
 * Build a report-ready loan row using canonical balance state and payment history.
 * @param {{ loan: object, paymentRepository: object, loanViewService: object }} dependencies
 * @returns {Promise<object>}
 */
const buildLoanReportRecord = async ({ loan, paymentRepository, loanViewService }) => {
  const payments = await paymentRepository.listByLoan(loan.id);
  const snapshot = loanViewService.getSnapshot(loan);
  const serializedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;

  return {
    ...serializedLoan,
    totalPaid: snapshot.totalPaid.toFixed(2),
    totalDue: snapshot.totalPayable.toFixed(2),
    outstandingAmount: snapshot.outstandingBalance.toFixed(2),
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

const createGetRecoveredLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const recoveredLoans = pagination
    ? await reportRepository.listRecoveredLoansPage(pagination)
    : await reportRepository.listRecoveredLoans();
  const rawLoans = recoveredLoans.items || recoveredLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  const totalRecoveredAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalLoansCount = recoveredLoans.pagination?.totalItems ?? loansWithDetails.length;
  const paged = paginateCollection(loansWithDetails, recoveredLoans.pagination);

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalLoansCount,
      averageRecoveryAmount: totalLoansCount > 0 ? (totalRecoveredAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: paged.items, ...(paged.pagination ? { pagination: paged.pagination } : {}) },
  };
};

const createGetOutstandingLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const outstandingLoans = pagination
    ? await reportRepository.listOutstandingLoansPage(pagination)
    : await reportRepository.listOutstandingLoans();
  const rawLoans = outstandingLoans.items || outstandingLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  const outstandingLoansFiltered = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  const totalOutstandingAmount = outstandingLoansFiltered.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansCount = outstandingLoans.pagination?.totalItems ?? outstandingLoansFiltered.length;
  const pendingCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'pending').length;
  const inProgressCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'in_progress').length;
  const paged = paginateCollection(outstandingLoansFiltered, outstandingLoans.pagination);

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansCount,
      pendingCount,
      inProgressCount,
      averageOutstandingAmount: totalLoansCount > 0 ? (totalOutstandingAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: paged.items, ...(paged.pagination ? { pagination: paged.pagination } : {}) },
  };
};

const createGetRecoveryReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const allLoans = pagination
    ? await reportRepository.listRecoveryLoansPage(pagination)
    : await reportRepository.listRecoveryLoans();
  const rawLoans = allLoans.items || allLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  const recoveredLoans = loansWithDetails.filter((loan) => loan.recoveryBucket === 'recovered');
  const outstandingLoans = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  const totalRecoveredAmount = recoveredLoans.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalOutstandingAmount = outstandingLoans.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalDue), 0);
  const recoveryRate = totalLoansAmount > 0 ? ((totalRecoveredAmount / totalLoansAmount) * 100).toFixed(2) : '0.00';

  return {
    success: true,
    summary: {
      totalLoans: loansWithDetails.length,
      recoveredLoans: recoveredLoans.length,
      outstandingLoans: outstandingLoans.length,
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansAmount: totalLoansAmount.toFixed(2),
      recoveryRate: `${recoveryRate}%`,
    },
    data: {
      recoveredLoans,
      outstandingLoans,
      ...(allLoans.pagination ? { pagination: allLoans.pagination } : {}),
    },
  };
};

const createGetDashboardSummary = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);

  const emptyResponse = {
    success: true,
    data: {
      summary: {
        totalLoans: 0,
        activeLoans: 0,
        defaultedLoans: 0,
        recoveredLoans: 0,
        totalPortfolioAmount: '0.00',
        totalRecoveredAmount: '0.00',
        totalOutstandingAmount: '0.00',
      },
      collections: {
        overdueAlerts: 0,
        pendingPromises: 0,
        unreadNotifications: 0,
      },
      recentActivity: {
        loans: [],
        payments: [],
        alerts: [],
        promises: [],
        notifications: [],
      },
    },
  };

  try {
    const dashboard = await reportRepository.getDashboardSummary();
    const monthlyPerformance = buildMonthlyPerformanceSeries({
      loans: dashboard.loans || [],
      payments: dashboard.payments || [],
    });
    const loansWithDetails = await buildLoansWithDetails({
      loans: dashboard.loans || [],
      paymentRepository,
      loanViewService,
    });

    const totalPortfolioAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
    const totalRecoveredAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalPaid || 0), 0);
    const totalOutstandingAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0);

    return {
      success: true,
      data: {
        summary: {
          totalLoans: loansWithDetails.length,
          activeLoans: loansWithDetails.filter((loan) => ['approved', 'active'].includes(loan.status)).length,
          defaultedLoans: loansWithDetails.filter((loan) => loan.status === 'defaulted').length,
          recoveredLoans: loansWithDetails.filter((loan) => loan.recoveryBucket === 'recovered').length,
          totalPortfolioAmount: totalPortfolioAmount.toFixed(2),
          totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
          totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
        },
        monthlyPerformance,
        collections: {
          overdueAlerts: (dashboard.alerts || []).length,
          pendingPromises: (dashboard.promises || []).filter((promise) => promise.status === 'pending').length,
          unreadNotifications: (dashboard.notifications || []).filter((notification) => !notification.isRead).length,
        },
        recentActivity: {
          loans: loansWithDetails.slice(0, 5),
          payments: (dashboard.payments || []).slice(0, 5),
          alerts: (dashboard.alerts || []).slice(0, 5),
          promises: (dashboard.promises || []).slice(0, 5),
          notifications: (dashboard.notifications || []).slice(0, 5),
        },
      },
    };
  } catch (_error) {
    return emptyResponse;
  }
};

const createGetCustomerHistory = ({ reportRepository }) => async ({ actor, customerId }) => {
  ensureAdmin(actor);

  const history = await reportRepository.getCustomerHistory(customerId);
  if (!history.customer) {
    throw new NotFoundError('Customer');
  }

  return {
    success: true,
    data: {
      customer: history.customer,
      timeline: buildCustomerHistoryTimeline(history),
      segments: {
        loans: history.loans || [],
        payments: history.payments || [],
        documents: history.documents || [],
        alerts: history.alerts || [],
        promises: history.promises || [],
        notifications: history.notifications || [],
      },
    },
  };
};

const createGetCustomerCreditProfile = ({ reportRepository }) => async ({ actor, customerId }) => {
  ensureAdmin(actor);

  const history = await reportRepository.getCustomerCreditProfileDataset(customerId);
  if (!history.customer) {
    throw new NotFoundError('Customer');
  }

  const loans = history.loans || [];
  const payments = history.payments || [];
  const alerts = history.alerts || [];
  const promises = history.promises || [];
  const documents = history.documents || [];
  const activeLoans = loans.filter((loan) => ['approved', 'active', 'defaulted'].includes(loan.status));
  const closedLoans = loans.filter((loan) => loan.status === 'closed');
  const completedPayments = payments.filter((payment) => payment.status === 'completed');
  const activeAlerts = alerts.filter((alert) => alert.status === 'active');
  const brokenPromises = promises.filter((promise) => promise.status === 'broken');
  const missingSections = [
    completedPayments.length === 0 ? 'payment_history' : null,
    documents.length === 0 ? 'supporting_documents' : null,
    buildServicingNotes({ alerts, promises }).length === 0 ? 'servicing_notes' : null,
  ].filter(Boolean);

  const profitabilityRows = buildProfitabilityLoanRows({ loans, payments: completedPayments });
  const customerProfitability = buildCustomerProfitabilityRows(profitabilityRows)
    .find((row) => Number(row.customerId) === Number(customerId)) || null;

  return {
    success: true,
    data: {
      customer: history.customer,
      profile: {
        summary: {
          totalLoans: loans.length,
          activeLoans: activeLoans.length,
          closedLoans: closedLoans.length,
          completedPayments: completedPayments.length,
          delinquentAlerts: activeAlerts.length,
          brokenPromises: brokenPromises.length,
          totalPaid: formatMoney(completedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
        },
        completeness: {
          isComplete: missingSections.length === 0,
          missingSections,
          sections: {
            loanHistory: { status: loans.length > 0 ? 'complete' : 'missing', count: loans.length },
            paymentHistory: { status: completedPayments.length > 0 ? 'complete' : 'missing', count: completedPayments.length },
            supportingDocuments: { status: documents.length > 0 ? 'complete' : 'missing', count: documents.length },
            servicingNotes: { status: buildServicingNotes({ alerts, promises }).length > 0 ? 'complete' : 'missing', count: buildServicingNotes({ alerts, promises }).length },
          },
        },
        delinquency: {
          activeAlerts,
          brokenPromises,
          pendingPromises: promises.filter((promise) => promise.status === 'pending'),
        },
        servicingNotes: buildServicingNotes({ alerts, promises }),
        profitability: customerProfitability,
      },
      timeline: buildCustomerHistoryTimeline(history),
      segments: {
        loans,
        payments,
        alerts,
        promises,
        documents,
        notifications: history.notifications || [],
      },
    },
  };
};

const createGetCustomerCreditHistory = ({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const [payments, alerts, promises] = await Promise.all([
    paymentRepository.listByLoan(loan.id),
    alertRepository?.listByLoan ? alertRepository.listByLoan(loan.id) : [],
    promiseRepository?.listByLoan ? promiseRepository.listByLoan(loan.id) : [],
  ]);
  const snapshot = loanViewService.getSnapshot(loan);
  const normalizedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;
  const payoffPayments = payments.filter((payment) => payment.paymentType === 'payoff');

  return {
    loan: normalizedLoan,
    snapshot,
    payments,
    alerts,
    promises,
    payoffHistory: payoffPayments.map((payment) => ({
      id: payment.id,
      paymentDate: payment.paymentDate,
      paymentType: payment.paymentType,
      status: payment.status,
      payoff: payment.paymentMetadata?.payoff || null,
    })),
    closure: {
      status: normalizedLoan.status,
      closedAt: normalizedLoan.closedAt || null,
      closureReason: normalizedLoan.closureReason || null,
    },
  };
};

const createExportCustomerHistory = ({ reportRepository }) => async ({ actor, customerId, format = 'pdf' }) => {
  const history = await createGetCustomerHistory({ reportRepository })({ actor, customerId });
  const data = history.data;
  const timelinePreview = (data.timeline || []).slice(0, 6);

  if (String(format).toLowerCase() === 'csv') {
    const csv = buildCsv({
      headers: ['eventType', 'entityType', 'occurredAt'],
      rows: timelinePreview.map((entry) => [entry.eventType, entry.entityType, formatIsoDate(entry.occurredAt)]),
    });

    return {
      fileName: `customer-${data.customer.id}-history.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `customer-${data.customer.id}-history.pdf`,
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: `Customer History #${data.customer.id}`,
      lines: [
        `Customer: ${data.customer.name || `#${data.customer.id}`}`,
        `Loans: ${data.segments.loans.length}`,
        `Payments: ${data.segments.payments.length}`,
        `Documents: ${data.segments.documents.length}`,
        `Alerts: ${data.segments.alerts.length}`,
        `Promises: ${data.segments.promises.length}`,
        `Notifications: ${data.segments.notifications.length}`,
        'Recent timeline:',
        ...timelinePreview.map((entry) => `${formatIsoDate(entry.occurredAt)} | ${entry.entityType} | ${entry.eventType}`),
      ],
    }),
  };
};

const createExportCustomerCreditProfile = ({ reportRepository }) => async ({ actor, customerId, format = 'pdf' }) => {
  const profile = await createGetCustomerCreditProfile({ reportRepository })({ actor, customerId });
  const data = profile.data;
  const summary = data.profile?.summary || {};
  const completeness = data.profile?.completeness || {};
  const profitability = data.profile?.profitability || null;
  const missingSections = Array.isArray(completeness.missingSections) && completeness.missingSections.length > 0
    ? completeness.missingSections.join('; ')
    : 'none';

  if (String(format).toLowerCase() === 'csv') {
    const csv = buildCsv({
      headers: ['customerId', 'customerName', 'totalLoans', 'activeLoans', 'completedPayments', 'delinquentAlerts', 'brokenPromises', 'totalPaid', 'isComplete', 'missingSections', 'profitability'],
      rows: [[
        data.customer.id,
        data.customer.name || '',
        summary.totalLoans || 0,
        summary.activeLoans || 0,
        summary.completedPayments || 0,
        summary.delinquentAlerts || 0,
        summary.brokenPromises || 0,
        summary.totalPaid || '0.00',
        completeness.isComplete ? 'yes' : 'no',
        missingSections,
        profitability?.totalProfit || '',
      ]],
    });

    return {
      fileName: `customer-${data.customer.id}-credit-profile.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `customer-${data.customer.id}-credit-profile.pdf`,
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: `Customer Credit Profile #${data.customer.id}`,
      lines: [
        `Customer: ${data.customer.name || `#${data.customer.id}`}`,
        `Total loans: ${summary.totalLoans || 0}`,
        `Active loans: ${summary.activeLoans || 0}`,
        `Closed loans: ${summary.closedLoans || 0}`,
        `Completed payments: ${summary.completedPayments || 0}`,
        `Delinquent alerts: ${summary.delinquentAlerts || 0}`,
        `Broken promises: ${summary.brokenPromises || 0}`,
        `Total paid: ${summary.totalPaid || '0.00'}`,
        `Complete profile: ${completeness.isComplete ? 'yes' : 'no'}`,
        `Missing sections: ${missingSections}`,
        `Profitability total: ${profitability?.totalProfit || 'N/A'}`,
      ],
    }),
  };
};

const createExportCustomerCreditHistory = ({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }) => async ({ actor, loanId, format = 'pdf' }) => {
  const history = await createGetCustomerCreditHistory({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository })({ actor, loanId });

  if (String(format).toLowerCase() === 'csv') {
    const csv = buildCsv({
      headers: ['paymentId', 'paymentDate', 'paymentType', 'status', 'amount'],
      rows: (history.payments || []).map((payment) => [payment.id, formatIsoDate(payment.paymentDate), payment.paymentType || '', payment.status || '', payment.amount || 0]),
    });

    return {
      fileName: `loan-${history.loan.id}-credit-history.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `loan-${history.loan.id}-credit-history.pdf`,
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: `Loan Credit History #${history.loan.id}`,
      lines: [
        `Customer ID: ${history.loan.customerId || 'N/A'}`,
        `Loan status: ${history.loan.status || 'N/A'}`,
        `Outstanding balance: ${formatMoney(history.snapshot?.outstandingBalance || 0)}`,
        `Total paid: ${formatMoney(history.snapshot?.totalPaid || 0)}`,
        `Payments recorded: ${history.payments?.length || 0}`,
        `Payoff entries: ${history.payoffHistory?.length || 0}`,
        `Closure reason: ${history.closure?.closureReason || 'N/A'}`,
        `Closed at: ${formatIsoDate(history.closure?.closedAt)}`,
      ],
    }),
  };
};

const buildRecoveryExportRows = (report) => ([
  ...report.data.recoveredLoans.map((loan) => ({
    section: 'recovered',
    loanId: loan.id,
    customer: loan.Customer?.name || '',
    amount: loan.amount,
    paid: loan.totalPaid,
    outstanding: loan.outstandingAmount,
    recoveryStatus: loan.recoveryStatus,
  })),
  ...report.data.outstandingLoans.map((loan) => ({
    section: 'outstanding',
    loanId: loan.id,
    customer: loan.Customer?.name || '',
    amount: loan.amount,
    paid: loan.totalPaid,
    outstanding: loan.outstandingAmount,
    recoveryStatus: loan.recoveryStatus,
  })),
]);

const createExportRecoveryReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, format = 'csv' }) => {
  ensureAdmin(actor);
  const report = await createGetRecoveryReport({ reportRepository, paymentRepository, loanViewService })({ actor });
  const rows = buildRecoveryExportRows(report);

  if (format === 'pdf') {
    return {
      fileName: 'recovery-report.pdf',
      contentType: 'application/pdf',
      buffer: buildPdfBuffer({
        title: 'CrediCobranza Recovery Report',
        lines: [
          `Total loans: ${report.summary.totalLoans}`,
          `Recovered loans: ${report.summary.recoveredLoans}`,
          `Outstanding loans: ${report.summary.outstandingLoans}`,
          `Total recovered amount: ${report.summary.totalRecoveredAmount}`,
          `Total outstanding amount: ${report.summary.totalOutstandingAmount}`,
          `Recovery rate: ${report.summary.recoveryRate}`,
        ],
      }),
    };
  }

  if (format === 'xlsx') {
    return {
      fileName: 'recovery-report.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildWorkbookBuffer([{ name: 'Recovery Report', rows }]),
    };
  }

  const csv = buildCsv({
    headers: ['section', 'loanId', 'customer', 'recoveryOwner', 'amount', 'paid', 'outstanding', 'recoveryStatus'],
    rows: rows.map((row) => [row.section, row.loanId, row.customer, row.recoveryOwner, row.amount, row.paid, row.outstanding, row.recoveryStatus]),
  });

  return {
    fileName: 'recovery-report.csv',
    contentType: 'text/csv; charset=utf-8',
    buffer: Buffer.from(csv, 'utf8'),
  };
};

const createGetAssociateProfitabilityReport = ({ associateRepository }) => async ({ actor, associateId = null }) => {
  const resolveAssociate = async () => {
    if (actor.role === 'admin') {
      return associateRepository.findById(associateId);
    }

    if (actor.role !== 'socio') {
      throw new AuthorizationError('Only admins and socios can access profitability reports');
    }

    return actor.associateId
      ? associateRepository.findById(actor.associateId)
      : associateRepository.findByLinkedUser(actor.id);
  };

  const associate = await resolveAssociate();
  if (!associate) {
    throw new AuthorizationError('Associate access is not configured for this user');
  }

  if (associateId && actor.role === 'socio' && Number(associate.id) !== Number(associateId)) {
    throw new AuthorizationError('Socio users can only access their own profitability data');
  }

  const [contributions, distributions, loans] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
    associateRepository.listLoansByAssociate(associate.id),
  ]);

  const totalContributed = contributions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalDistributed = distributions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: totalContributed.toFixed(2),
      totalDistributed: totalDistributed.toFixed(2),
      netProfit: totalDistributed.toFixed(2),
      contributionCount: contributions.length,
      distributionCount: distributions.length,
      loanCount: loans.length,
      participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
    },
    data: {
      contributions,
      distributions: distributions.map(normalizeDistributionRecord),
      loans,
    },
  };
};

const createExportAssociateProfitabilityReport = ({ reportRepository, associateRepository }) => async ({ actor, associateId, format = 'xlsx' }) => {
  const report = await createGetAssociateProfitabilityReport({ associateRepository })({ actor, associateId });
  const dataset = await reportRepository.getAssociateExportDataset(report.associate.id);

  const contributionRows = (dataset.contributions || []).map((entry) => ({
    id: entry.id,
    amount: entry.amount,
    contributionDate: entry.contributionDate,
    notes: entry.notes || '',
  }));
  const distributionRows = (dataset.distributions || []).map((entry) => {
    const normalizedEntry = normalizeDistributionRecord(entry);

    return {
      id: entry.id,
      loanId: entry.loanId,
      amount: entry.amount,
      distributionDate: entry.distributionDate,
      distributionType: normalizedEntry.distributionType,
      participationPercentage: normalizedEntry.participationPercentage || normalizeParticipationPercentage(dataset.associate?.participationPercentage),
      declaredProportionalTotal: normalizedEntry.declaredProportionalTotal,
      allocatedAmount: normalizedEntry.allocatedAmount,
      notes: entry.notes || '',
    };
  });
  const loanRows = (dataset.loans || []).map((entry) => ({
    id: entry.id,
    customer: entry.Customer?.name || '',
    amount: entry.amount,
    status: entry.status,
    recoveryStatus: entry.recoveryStatus || '',
  }));

  if (format === 'csv') {
    const csv = buildCsv({
      headers: ['section', 'id', 'reference', 'amount', 'date', 'status', 'participationPercentage', 'distributionType', 'declaredProportionalTotal', 'allocatedAmount', 'notes'],
      rows: [
        ...contributionRows.map((row) => ['contribution', row.id, '', row.amount, row.contributionDate, '', normalizeParticipationPercentage(dataset.associate?.participationPercentage), '', '', '', row.notes]),
        ...distributionRows.map((row) => [
          'distribution',
          row.id,
          row.loanId || '',
          row.amount,
          row.distributionDate,
          '',
          row.participationPercentage || '',
          row.distributionType,
          row.declaredProportionalTotal || '',
          row.allocatedAmount || '',
          row.notes,
        ]),
        ...loanRows.map((row) => ['loan', row.id, row.customer, row.amount, '', row.status, normalizeParticipationPercentage(dataset.associate?.participationPercentage), '', '', '', row.recoveryStatus]),
      ],
    });

    return {
      fileName: `associate-${report.associate.id}-profitability.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `associate-${report.associate.id}-profitability.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buildWorkbookBuffer([
      { name: 'Summary', rows: [{ ...report.summary, associate: report.associate.name, associateId: report.associate.id }] },
      { name: 'Contributions', rows: contributionRows },
      { name: 'Distributions', rows: distributionRows },
      { name: 'Loans', rows: loanRows },
    ]),
  };
};

const createGetCustomerProfitabilityReport = ({ reportRepository }) => async ({ actor, filters = {}, pagination }) => {
  ensureAdmin(actor);

  const dateRange = parseDateRange(filters);

  if (pagination) {
    const [summaryDataset, pagedResult] = await Promise.all([
      reportRepository.listProfitabilityDataset(dateRange),
      reportRepository.listCustomerProfitabilityPage({
        ...dateRange,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    ]);

    return {
      success: true,
      count: pagedResult.pagination.totalItems,
      summary: buildProfitabilitySummaryFromDataset(summaryDataset),
      data: {
        customers: buildCustomerProfitabilityRows(
          buildProfitabilityLoanRows({
            loans: pagedResult.items.loans,
            payments: pagedResult.items.payments,
          }),
        ),
        pagination: pagedResult.pagination,
      },
    };
  }

  const { loans, payments } = await reportRepository.listProfitabilityDataset(dateRange);
  const loanRows = buildProfitabilityLoanRows({ loans, payments });
  const customerRows = buildCustomerProfitabilityRows(loanRows);

  return {
    success: true,
    count: customerRows.length,
    summary: buildProfitabilitySummary(customerRows),
    data: {
      customers: customerRows,
    },
  };
};

const createGetLoanProfitabilityReport = ({ reportRepository }) => async ({ actor, filters = {}, pagination }) => {
  ensureAdmin(actor);

  const dateRange = parseDateRange(filters);

  if (pagination) {
    const [summaryDataset, pagedResult] = await Promise.all([
      reportRepository.listProfitabilityDataset(dateRange),
      reportRepository.listLoanProfitabilityPage({
        ...dateRange,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    ]);

    return {
      success: true,
      count: pagedResult.pagination.totalItems,
      summary: buildProfitabilitySummaryFromDataset(summaryDataset),
      data: {
        loans: buildProfitabilityLoanRows({
          loans: pagedResult.items.loans,
          payments: pagedResult.items.payments,
        }),
        pagination: pagedResult.pagination,
      },
    };
  }

  const { loans, payments } = await reportRepository.listProfitabilityDataset(dateRange);
  const loanRows = buildProfitabilityLoanRows({ loans, payments });

  return {
    success: true,
    count: loanRows.length,
    summary: buildProfitabilitySummary(loanRows),
    data: {
      loans: loanRows,
    },
  };
};

module.exports = {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditProfile,
  createGetCustomerCreditHistory,
  createExportCustomerHistory,
  createExportCustomerCreditProfile,
  createExportCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
  createGetCustomerProfitabilityReport,
  createGetLoanProfitabilityReport,
  // New financial analytics use cases
  createGetCreditEarnings: require('./useCases/createGetCreditEarnings').createGetCreditEarnings,
  createGetInterestEarnings: require('./useCases/createGetInterestEarnings').createGetInterestEarnings,
  createGetMonthlyEarnings: require('./useCases/createGetMonthlyEarnings').createGetMonthlyEarnings,
  createGetMonthlyInterest: require('./useCases/createGetMonthlyInterest').createGetMonthlyInterest,
  createGetPerformanceAnalysis: require('./useCases/createGetPerformanceAnalysis').createGetPerformanceAnalysis,
  createGetExecutiveDashboard: require('./useCases/createGetExecutiveDashboard').createGetExecutiveDashboard,
  createGetComprehensiveAnalytics: require('./useCases/createGetComprehensiveAnalytics').createGetComprehensiveAnalytics,
  createGetComparativeAnalysis: require('./useCases/createGetComparativeAnalysis').createGetComparativeAnalysis,
  createGetForecastAnalysis: require('./useCases/createGetForecastAnalysis').createGetForecastAnalysis,
  createGetNextMonthProjection: require('./useCases/createGetNextMonthProjection').createGetNextMonthProjection,
  // Excel export use cases
  createExportCreditsExcel: require('./useCases/createExportCreditsExcel').createExportCreditsExcel,
  createGetCreditsSummary: require('./useCases/createGetCreditsSummary').createGetCreditsSummary,
  createExportAssociatesExcel: require('./useCases/createExportAssociatesExcel').createExportAssociatesExcel,
  createExportPayoutsExcel: require('./useCases/createExportPayoutsExcel').createExportPayoutsExcel,
  // Enhanced reports use cases
  createGetPayoutsReport: require('./useCases/createGetPayoutsReport').createGetPayoutsReport,
  createGetPaymentSchedule: require('./useCases/createGetPaymentSchedule').createGetPaymentSchedule,
};
