const { ensureAdmin, formatMoney } = require('@/modules/reports/application/reportHelpers');

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

/**
 * Create use case: Export Credits to Excel
 * Exports all credits with full details including customer, amounts, status, and payments.
 * GET /api/reports/credits/excel
 */
const createExportCreditsExcel = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor, 'Only admins can export credits data');

  const loans = await reportRepository.listOutstandingLoans();

  // Build detailed rows with payment info
  const rows = await Promise.all(
    loans.map(async (loan) => {
      const _serializedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;
      const payments = await paymentRepository.listByLoan(loan.id);
      const snapshot = loanViewService.getSnapshot(loan);

      const completedPayments = payments.filter((p) => p.status === 'completed');
      const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
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
        installmentAmount: formatMoney(snapshot.installmentAmount),
        termMonths: loan.termMonths || 'N/A',
        status: loan.status || 'N/A',
        recoveryStatus: loan.recoveryStatus || 'N/A',
        totalPaid: formatMoney(totalPaid),
        totalInterest: formatMoney(totalInterest),
        totalPenalty: formatMoney(totalPenalty),
        outstandingAmount: formatMoney(snapshot.outstandingBalance),
        paymentCount: completedPayments.length,
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
