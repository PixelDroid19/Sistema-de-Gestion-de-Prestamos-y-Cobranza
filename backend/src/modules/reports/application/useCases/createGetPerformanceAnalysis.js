const { calculateTrend, calculateMovingAverage, calculateChangePercent } = require('./statistics');
const { ensureAdmin, formatMoney, mapMonthlySeries } = require('../reportHelpers');

/**
 * Create use case: Get Performance Analysis
 * Returns comprehensive performance KPIs with trend analysis.
 * GET /api/reports/performance-analysis?year={year}
 */
const createGetPerformanceAnalysis = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const metrics = await reportRepository.getPerformanceMetrics(targetYear);
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);

  const monthlyPerformance = mapMonthlySeries({
    year: targetYear,
    rows: monthlyData,
    valueKey: 'totalEarnings',
  }).map((entry) => ({ month: entry.month, totalEarnings: entry.value }));

  const earningsValues = monthlyPerformance.map((m) => m.totalEarnings);
  const movingAverages = calculateMovingAverage(earningsValues, 3);

  const monthlyWithTrends = monthlyPerformance.map((m, i) => {
    const prevEarnings = i > 0 ? monthlyPerformance[i - 1].totalEarnings : 0;
    return {
      month: m.month,
      earnings: formatMoney(m.totalEarnings),
      trend: calculateTrend(earningsValues.slice(0, i + 1)),
      changePercent: calculateChangePercent(m.totalEarnings, prevEarnings),
      movingAverage: formatMoney(movingAverages[i] || 0),
    };
  });

  return {
    success: true,
    data: {
      year: targetYear,
      summary: {
        totalEarnings: formatMoney(metrics.totalEarnings),
        totalInterest: formatMoney(metrics.totalInterest),
        totalPenalties: formatMoney(metrics.totalPenalties),
        paymentCount: metrics.paymentCount,
        totalLoans: metrics.totalLoans,
        totalLoanAmount: formatMoney(metrics.totalLoanAmount),
      },
      monthlyPerformance: monthlyWithTrends,
    },
  };
};

module.exports = { createGetPerformanceAnalysis };
