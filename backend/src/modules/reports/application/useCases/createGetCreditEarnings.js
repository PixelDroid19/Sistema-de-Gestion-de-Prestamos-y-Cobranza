const { ensureAdmin, formatMoney } = require('../reportHelpers');

/**
 * Create use case: Get Credit Earnings Report
 * Aggregates credit and earnings metrics from all credits.
 * GET /api/reports/credit-earnings
 */
const createGetCreditEarnings = ({ reportRepository }) => async ({ actor }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const loans = await reportRepository.listOutstandingLoans();

  const totalCredits = loans.length;
  const totalLoanAmount = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);

  // Calculate total interest earnings from completed payments
  let totalInterestEarnings = 0;
  for (const loan of loans) {
    const _payments = await reportRepository.listRecoveryLoans();
    // Use existing payment data if available, otherwise use loan's totalPaid as proxy
    totalInterestEarnings += Number(loan.totalPaid || 0) - Number(loan.amount || 0);
  }

  // More accurate: calculate from payments in the system
  const metrics = await reportRepository.getPerformanceMetrics(new Date().getFullYear());
  totalInterestEarnings = metrics.totalInterest;

  const profitMargin = totalLoanAmount > 0 ? ((totalInterestEarnings / totalLoanAmount) * 100) : 0;

  return {
    success: true,
    data: {
      totalCredits,
      totalLoanAmount: formatMoney(totalLoanAmount),
      totalInterestEarnings: formatMoney(totalInterestEarnings),
      profitMargin: formatMoney(profitMargin),
    },
  };
};

module.exports = { createGetCreditEarnings };
