const { calculateTrend, calculateMovingAverage, calculateChangePercent } = require('./statistics');
const { ensureAdmin, formatMoney, mapMonthlySeries } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Performance Analysis
 * Returns comprehensive performance KPIs with trend analysis.
 * GET /api/reports/performance-analysis?year={year}
 */
const createGetPerformanceAnalysis = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder a reportes financieros.');

  const targetYear = year || new Date().getFullYear();
  const metrics = await reportRepository.getPerformanceMetrics(targetYear);
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);

  const monthlyPerformance = mapMonthlySeries({
    year: targetYear,
    rows: monthlyData,
    valueKey: 'totalEarnings',
  }).map((entry) => {
    const sourceRow = monthlyData.find((row) => row.month === entry.month) || {};
    return {
      month: entry.month,
      totalEarnings: entry.value,
      totalInterest: Number(sourceRow.totalInterest || 0),
      totalPenalties: Number(sourceRow.totalPenalties || 0),
    };
  });

  const earningsValues = monthlyPerformance.map((m) => m.totalEarnings);
  const movingAverages = calculateMovingAverage(earningsValues, 3);

  const monthlyWithTrends = monthlyPerformance.map((m, i) => {
    const prevEarnings = i > 0 ? monthlyPerformance[i - 1].totalEarnings : 0;
    return {
      month: m.month,
      earnings: formatMoney(m.totalEarnings),
      interest: formatMoney(m.totalInterest),
      penalties: formatMoney(m.totalPenalties),
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
