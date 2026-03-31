const { AuthorizationError } = require('../../../../utils/errorHandler');
const { calculateTrend, calculateMovingAverage, calculateChangePercent } = require('./statistics');

const ensureAdmin = (actor) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can access financial reports');
  }
};

const formatMoney = (value) => Number(value || 0).toFixed(2);
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/**
 * Create use case: Get Performance Analysis
 * Returns comprehensive performance KPIs with trend analysis.
 * GET /api/reports/performance-analysis?year={year}
 */
const createGetPerformanceAnalysis = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor);

  const targetYear = year || new Date().getFullYear();
  const metrics = await reportRepository.getPerformanceMetrics(targetYear);
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);

  // Build monthly earnings map
  const earningsByMonth = {};
  monthlyData.forEach((m) => {
    if (m.month) {
      earningsByMonth[m.month] = m.totalEarnings;
    }
  });

  // Calculate monthly metrics with trends
  const monthlyPerformance = MONTHS.map((m) => {
    const monthKey = `${targetYear}-${m}`;
    const totalEarnings = earningsByMonth[monthKey] || 0;
    return { month: monthKey, totalEarnings };
  });

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
