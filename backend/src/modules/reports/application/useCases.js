const XLSX = require('xlsx');
const { AuthorizationError, NotFoundError } = require('../../../utils/errorHandler');

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

const ensureAdmin = (actor) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can access reports');
  }
};

const RECOVERY_BALANCE_TOLERANCE = 0.01;

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

const createGetRecoveredLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);
  const recoveredLoans = await reportRepository.listRecoveredLoans();
  const loansWithDetails = await buildLoansWithDetails({ loans: recoveredLoans, paymentRepository, loanViewService });
  const totalRecoveredAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalLoansCount = loansWithDetails.length;

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalLoansCount,
      averageRecoveryAmount: totalLoansCount > 0 ? (totalRecoveredAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: loansWithDetails },
  };
};

const createGetOutstandingLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);
  const outstandingLoans = await reportRepository.listOutstandingLoans();
  const loansWithDetails = await buildLoansWithDetails({ loans: outstandingLoans, paymentRepository, loanViewService });
  const outstandingLoansFiltered = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  const totalOutstandingAmount = outstandingLoansFiltered.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansCount = outstandingLoansFiltered.length;
  const pendingCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'pending').length;
  const inProgressCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'in_progress').length;

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
    data: { loans: outstandingLoansFiltered },
  };
};

const createGetRecoveryReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);
  const allLoans = await reportRepository.listRecoveryLoans();
  const loansWithDetails = await buildLoansWithDetails({ loans: allLoans, paymentRepository, loanViewService });
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

  const timeline = [
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
  ].sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));

  return {
    success: true,
    data: {
      customer: history.customer,
      timeline,
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

const createGetCustomerCreditHistory = ({ paymentRepository, loanViewService, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const payments = await paymentRepository.listByLoan(loan.id);
  const snapshot = loanViewService.getSnapshot(loan);
  const normalizedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;
  const payoffPayments = payments.filter((payment) => payment.paymentType === 'payoff');

  return {
    loan: normalizedLoan,
    snapshot,
    payments,
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

const buildRecoveryExportRows = (report) => ([
  ...report.data.recoveredLoans.map((loan) => ({
    section: 'recovered',
    loanId: loan.id,
    customer: loan.Customer?.name || '',
    agent: loan.Agent?.name || '',
    amount: loan.amount,
    paid: loan.totalPaid,
    outstanding: loan.outstandingAmount,
    recoveryStatus: loan.recoveryStatus,
  })),
  ...report.data.outstandingLoans.map((loan) => ({
    section: 'outstanding',
    loanId: loan.id,
    customer: loan.Customer?.name || '',
    agent: loan.Agent?.name || '',
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
        title: 'LendFlow Recovery Report',
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
    headers: ['section', 'loanId', 'customer', 'agent', 'amount', 'paid', 'outstanding', 'recoveryStatus'],
    rows: rows.map((row) => [row.section, row.loanId, row.customer, row.agent, row.amount, row.paid, row.outstanding, row.recoveryStatus]),
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
    associate,
    summary: {
      totalContributed: totalContributed.toFixed(2),
      totalDistributed: totalDistributed.toFixed(2),
      netProfit: totalDistributed.toFixed(2),
      contributionCount: contributions.length,
      distributionCount: distributions.length,
      loanCount: loans.length,
    },
    data: {
      contributions,
      distributions,
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
  const distributionRows = (dataset.distributions || []).map((entry) => ({
    id: entry.id,
    loanId: entry.loanId,
    amount: entry.amount,
    distributionDate: entry.distributionDate,
    notes: entry.notes || '',
  }));
  const loanRows = (dataset.loans || []).map((entry) => ({
    id: entry.id,
    customer: entry.Customer?.name || '',
    amount: entry.amount,
    status: entry.status,
    recoveryStatus: entry.recoveryStatus || '',
  }));

  if (format === 'csv') {
    const csv = buildCsv({
      headers: ['section', 'id', 'reference', 'amount', 'date', 'status', 'notes'],
      rows: [
        ...contributionRows.map((row) => ['contribution', row.id, '', row.amount, row.contributionDate, '', row.notes]),
        ...distributionRows.map((row) => ['distribution', row.id, row.loanId || '', row.amount, row.distributionDate, '', row.notes]),
        ...loanRows.map((row) => ['loan', row.id, row.customer, row.amount, '', row.status, row.recoveryStatus]),
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

module.exports = {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
};
