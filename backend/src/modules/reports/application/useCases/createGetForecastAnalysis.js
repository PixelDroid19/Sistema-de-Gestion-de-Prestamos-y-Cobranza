const { calculateForecast, calculateTrend, calculateMovingAverage } = require('./statistics');
const { ensureAdmin, formatMoney, mapMonthlySeries } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Forecast Analysis
 * Returns earnings forecast using linear regression.
 * GET /api/reports/forecast-analysis?year={year}
 */
const createGetForecastAnalysis = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);

  const monthlySeries = mapMonthlySeries({ year: targetYear, rows: monthlyData, valueKey: 'totalEarnings' });
  const monthlyEarnings = monthlySeries.map((entry) => entry.value);

  const forecast = calculateForecast(monthlyEarnings);
  const trend = calculateTrend(monthlyEarnings);
  const movingAverages = calculateMovingAverage(monthlyEarnings, 3);

  return {
    success: true,
    data: {
      year: targetYear,
      historicalData: monthlyEarnings.map((e, i) => ({
        month: monthlySeries[i].month,
        earnings: formatMoney(e),
      })),
      forecast: {
        nextMonthEarnings: formatMoney(forecast.forecast),
        slope: formatMoney(forecast.slope),
        intercept: formatMoney(forecast.intercept),
      },
      analysis: {
        trend,
        currentMovingAverage: formatMoney(movingAverages[movingAverages.length - 1] || 0),
        isPositiveTrend: forecast.slope > 0,
      },
    },
  };
};

module.exports = { createGetForecastAnalysis };
