const { calculateForecast } = require('./statistics');
const { ensureAdmin, formatMoney } = require('../reportHelpers');

/**
 * Create use case: Get Next Month Projection
 * Returns projected earnings for the next month based on historical data.
 * GET /api/reports/next-month-projection
 */
const createGetNextMonthProjection = ({ reportRepository }) => async ({ actor }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  // Get 6 months of historical data for projection
  const historicalMonths = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(currentYear, currentMonth - i, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    historicalMonths.push({ year, month: String(month).padStart(2, '0') });
  }

  const monthlyData = await reportRepository.getMonthlyEarnings(currentYear);

  // Build earnings map
  const earningsByMonth = {};
  monthlyData.forEach((m) => {
    if (m.month) earningsByMonth[m.month] = m.totalEarnings;
  });

  // Get historical earnings in order
  const historicalEarnings = historicalMonths.map((h) => {
    const key = `${h.year}-${h.month}`;
    return earningsByMonth[key] || 0;
  });

  const forecast = calculateForecast(historicalEarnings);

  // Determine next month
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');

  return {
    success: true,
    data: {
      projection: {
        month: `${nextYear}-${nextMonth}`,
        projectedEarnings: formatMoney(Math.max(0, forecast.forecast)),
        confidenceLevel: historicalEarnings.filter((e) => e > 0).length >= 3 ? 'medium' : 'low',
        basedOnMonths: historicalEarnings.length,
      },
      model: {
        slope: formatMoney(forecast.slope),
        intercept: formatMoney(forecast.intercept),
      },
      historicalSummary: {
        averageEarnings: formatMoney(
          historicalEarnings.reduce((sum, e) => sum + e, 0) / historicalEarnings.length
        ),
        lastMonthEarnings: formatMoney(historicalEarnings[historicalEarnings.length - 1] || 0),
      },
    },
  };
};

module.exports = { createGetNextMonthProjection };
