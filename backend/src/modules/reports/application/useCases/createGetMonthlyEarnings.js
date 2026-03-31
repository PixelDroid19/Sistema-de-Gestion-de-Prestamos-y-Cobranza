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
 * Create use case: Get Monthly Earnings Report
 * Returns monthly earnings with trend analysis for a given year.
 * GET /api/reports/monthly-earnings?year={year}
 */
const createGetMonthlyEarnings = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor);

  const targetYear = year || new Date().getFullYear();
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);

  // Fill in missing months with zeros
  const earningsByMonth = {};
  monthlyData.forEach((m) => {
    if (m.month) {
      earningsByMonth[m.month] = m.totalEarnings;
    }
  });

  const months = MONTHS.map((m) => {
    const monthKey = `${targetYear}-${m}`;
    const totalEarnings = earningsByMonth[monthKey] || 0;
    return { month: monthKey, totalEarnings };
  });

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
