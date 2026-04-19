const { calculateChangePercent } = require('./statistics');
const { ensureAdmin, formatMoney } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Comparative Analysis
 * Returns period-over-period comparison.
 * GET /api/reports/comparative-analysis?year={year}
 */
const createGetComparativeAnalysis = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const currentMetrics = await reportRepository.getPerformanceMetrics(targetYear);
  const previousYear = targetYear - 1;
  const prevMetrics = await reportRepository.getPerformanceMetrics(previousYear);

  return {
    success: true,
    data: {
      currentYear: targetYear,
      previousYear,
      comparison: {
        earnings: {
          current: formatMoney(currentMetrics.totalEarnings),
          previous: formatMoney(prevMetrics.totalEarnings),
          changePercent: calculateChangePercent(currentMetrics.totalEarnings, prevMetrics.totalEarnings),
        },
        interest: {
          current: formatMoney(currentMetrics.totalInterest),
          previous: formatMoney(prevMetrics.totalInterest),
          changePercent: calculateChangePercent(currentMetrics.totalInterest, prevMetrics.totalInterest),
        },
        penalties: {
          current: formatMoney(currentMetrics.totalPenalties),
          previous: formatMoney(prevMetrics.totalPenalties),
          changePercent: calculateChangePercent(currentMetrics.totalPenalties, prevMetrics.totalPenalties),
        },
        payments: {
          current: currentMetrics.paymentCount,
          previous: prevMetrics.paymentCount,
          changePercent: calculateChangePercent(currentMetrics.paymentCount, prevMetrics.paymentCount),
        },
        loans: {
          current: currentMetrics.totalLoans,
          previous: prevMetrics.totalLoans,
          changePercent: calculateChangePercent(currentMetrics.totalLoans, prevMetrics.totalLoans),
        },
        loanAmount: {
          current: formatMoney(currentMetrics.totalLoanAmount),
          previous: formatMoney(prevMetrics.totalLoanAmount),
          changePercent: calculateChangePercent(currentMetrics.totalLoanAmount, prevMetrics.totalLoanAmount),
        },
      },
    },
  };
};

module.exports = { createGetComparativeAnalysis };
