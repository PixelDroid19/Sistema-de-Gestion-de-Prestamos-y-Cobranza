const { calculateTrend, calculateMovingAverage, calculateChangePercent } = require('./statistics');
const { ensureAdmin, formatMoney, mapMonthlySeries } = require('../reportHelpers');

/**
 * Create use case: Get Monthly Earnings Report
 * Returns monthly earnings with trend analysis for a given year.
 * GET /api/reports/monthly-earnings?year={year}
 */
const createGetMonthlyEarnings = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);
  const months = mapMonthlySeries({
    year: targetYear,
    rows: monthlyData,
    valueKey: 'totalEarnings',
  }).map((entry) => ({ month: entry.month, totalEarnings: entry.value }));

  // Calculate trend, moving average, and change percent
  const earningsValues = months.map((m) => m.totalEarnings);
  const movingAverages = calculateMovingAverage(earningsValues, 3);

  const monthsWithAnalysis = months.map((m, i) => {
    const prevEarnings = i > 0 ? months[i - 1].totalEarnings : 0;
    return {
      month: m.month,
      totalEarnings: formatMoney(m.totalEarnings),
      trend: calculateTrend(earningsValues.slice(0, i + 1)),
      changePercent: calculateChangePercent(m.totalEarnings, prevEarnings),
      movingAverage: formatMoney(movingAverages[i] || 0),
    };
  });

  return {
    success: true,
    data: {
      year: targetYear,
      months: monthsWithAnalysis,
    },
  };
};

module.exports = { createGetMonthlyEarnings };
