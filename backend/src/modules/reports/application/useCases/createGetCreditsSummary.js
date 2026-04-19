const { ensureAdmin, formatMoney } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Credits Summary
 * Returns aggregate statistics for all credits.
 * GET /api/reports/credits/summary
 */
const createGetCreditsSummary = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor, 'Only admins can access credits summary');

  const loans = await reportRepository.listOutstandingLoans();

  // Calculate aggregate metrics
  let totalAmount = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let totalInterest = 0;
  let activeCount = 0;
  let defaultedCount = 0;
  let closedCount = 0;

  for (const loan of loans) {
    const payments = await paymentRepository.listByLoan(loan.id);
    const snapshot = loanViewService.getSnapshot(loan);
    const completedPayments = payments.filter((p) => p.status === 'completed');

    const loanTotalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const loanInterest = completedPayments.reduce((sum, p) => sum + Number(p.interestApplied || 0), 0);

    totalAmount += Number(loan.amount || 0);
    totalPaid += loanTotalPaid;
    totalOutstanding += snapshot.outstandingBalance;
    totalInterest += loanInterest;

    if (loan.status === 'active' || loan.status === 'approved') {
      activeCount++;
    } else if (loan.status === 'defaulted') {
      defaultedCount++;
    } else if (loan.status === 'closed') {
      closedCount++;
    }
  }

  const byStatus = {
    active: loans.filter((l) => l.status === 'active' || l.status === 'approved').length,
    defaulted: loans.filter((l) => l.status === 'defaulted').length,
    closed: loans.filter((l) => l.status === 'closed').length,
  };

  const byRecoveryStatus = {
    recovered: loans.filter((l) => l.recoveryStatus === 'recovered' || l.status === 'closed').length,
    pending: loans.filter((l) => l.recoveryStatus === 'pending').length,
    inProgress: loans.filter((l) => l.recoveryStatus === 'in_progress').length,
    overdue: loans.filter((l) => l.recoveryStatus === 'overdue' || l.status === 'defaulted').length,
  };

  return {
    success: true,
    data: {
      summary: {
        totalLoans: loans.length,
        totalAmount: formatMoney(totalAmount),
        totalPaid: formatMoney(totalPaid),
        totalOutstanding: formatMoney(totalOutstanding),
        totalInterest: formatMoney(totalInterest),
        activeCount,
        defaultedCount,
        closedCount,
        recoveryRate: totalAmount > 0 ? ((totalPaid / totalAmount) * 100).toFixed(2) : '0.00',
      },
      byStatus,
      byRecoveryStatus,
    },
  };
};

module.exports = { createGetCreditsSummary };
