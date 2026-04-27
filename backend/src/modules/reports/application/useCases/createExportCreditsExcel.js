const { ensureAdmin, formatMoney } = require('@/modules/reports/application/reportHelpers');

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const toPlainLoan = (loan) => (typeof loan?.toJSON === 'function' ? loan.toJSON() : loan);

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const parseDateOrNull = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pickLoanDate = (loan) => (
  loan?.startDate
  || loan?.approvedAt
  || loan?.disbursedAt
  || loan?.createdAt
);

const normalizeCreditExportFilters = (filters = {}) => ({
  customerId: toNumberOrNull(filters.customerId),
  loanId: toNumberOrNull(filters.loanId ?? filters.creditId),
  startDate: parseDateOrNull(filters.startDate ?? filters.fromDate),
  endDate: parseDateOrNull(filters.endDate ?? filters.toDate),
});

const matchesFilters = (loan, filters) => {
  if (filters.customerId !== null && Number(loan?.customerId) !== filters.customerId) {
    return false;
  }

  if (filters.loanId !== null && Number(loan?.id) !== filters.loanId) {
    return false;
  }

  const rawLoanDate = pickLoanDate(loan);
  const loanDate = rawLoanDate ? new Date(rawLoanDate) : null;
  if ((filters.startDate || filters.endDate) && (!loanDate || Number.isNaN(loanDate.getTime()))) {
    return false;
  }

  if (filters.startDate && loanDate < filters.startDate) {
    return false;
  }

  if (filters.endDate) {
    const inclusiveEnd = new Date(filters.endDate);
    inclusiveEnd.setHours(23, 59, 59, 999);
    if (loanDate > inclusiveEnd) {
      return false;
    }
  }

  return true;
};

const resolvePolicySnapshot = (loan) => (
  loan?.policySnapshot
  || loan?.financialSnapshot?.policySnapshot
  || loan?.calculationSnapshot?.policySnapshot
  || {}
);

/**
 * Create use case: Export Credits to Excel
 * Exports all credits with full details including customer, amounts, status, and payments.
 * GET /api/reports/credits/excel
 */
const createExportCreditsExcel = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Only admins can export credits data');

  const normalizedFilters = normalizeCreditExportFilters(filters);
  const loans = (await reportRepository.listOutstandingLoans())
    .map(toPlainLoan)
    .filter((loan) => matchesFilters(loan, normalizedFilters));

  // Build detailed rows with payment info
  const rows = await Promise.all(
    loans.map(async (loan) => {
      const payments = await paymentRepository.listByLoan(loan.id);
      const snapshot = loanViewService.getSnapshot(loan);
      const policySnapshot = resolvePolicySnapshot(loan);

      const completedPayments = payments.filter((p) => p.status === 'completed');
      const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalPrincipal = completedPayments.reduce((sum, p) => sum + Number(p.principalApplied || 0), 0);
      const totalInterest = completedPayments.reduce((sum, p) => sum + Number(p.interestApplied || 0), 0);
      const totalPenalty = completedPayments.reduce((sum, p) => sum + Number(p.penaltyApplied || 0), 0);

      return {
        loanId: loan.id,
        customerId: loan.customerId,
        customerName: loan.Customer?.name || 'N/A',
        customerEmail: loan.Customer?.email || 'N/A',
        customerPhone: loan.Customer?.phone || 'N/A',
        associateName: loan.Associate?.name || 'N/A',
        amount: formatMoney(loan.amount),
        interestRate: loan.interestRate || 'N/A',
        calculationMethod: loan.calculationMethod || loan.financialSnapshot?.calculationMethod || 'FRENCH',
        dagGraphVersionId: loan.dagGraphVersionId || loan.graphVersionId || 'N/A',
        ratePolicyId: loan.ratePolicyId || policySnapshot?.ratePolicyId || 'N/A',
        ratePolicyLabel: policySnapshot?.ratePolicyLabel || policySnapshot?.ratePolicy?.label || 'N/A',
        lateFeePolicyId: loan.lateFeePolicyId || policySnapshot?.lateFeePolicyId || 'N/A',
        lateFeePolicyLabel: policySnapshot?.lateFeePolicyLabel || policySnapshot?.lateFeePolicy?.label || 'N/A',
        installmentAmount: formatMoney(snapshot.installmentAmount),
        termMonths: loan.termMonths || 'N/A',
        status: loan.status || 'N/A',
        recoveryStatus: loan.recoveryStatus || 'N/A',
        totalPaid: formatMoney(totalPaid),
        totalPrincipal: formatMoney(totalPrincipal),
        totalInterest: formatMoney(totalInterest),
        totalPenalty: formatMoney(totalPenalty),
        outstandingPrincipal: formatMoney(snapshot.outstandingPrincipal),
        outstandingInterest: formatMoney(snapshot.outstandingInterest),
        outstandingAmount: formatMoney(snapshot.outstandingBalance),
        paymentCount: completedPayments.length,
        startDate: formatIsoDate(loan.startDate),
        createdAt: formatIsoDate(loan.createdAt),
        approvedAt: formatIsoDate(loan.approvedAt),
        closedAt: formatIsoDate(loan.closedAt),
      };
    }),
  );

  return {
    success: true,
    data: { rows },
  };
};

module.exports = { createExportCreditsExcel };
