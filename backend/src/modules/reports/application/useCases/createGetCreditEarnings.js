const { ensureAdmin, formatMoney } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Credit Earnings Report
 * Aggregates credit and earnings metrics from all credits.
 * GET /api/reports/credit-earnings
 */
const createGetCreditEarnings = ({ reportRepository }) => async ({ actor }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder a reportes financieros.');

  const loans = await reportRepository.listOutstandingLoans();

  const totalCredits = loans.length;
  const totalLoanAmount = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const metrics = await reportRepository.getPerformanceMetrics(new Date().getFullYear());
  const totalInterestEarnings = Number(metrics.totalInterest || 0);

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
