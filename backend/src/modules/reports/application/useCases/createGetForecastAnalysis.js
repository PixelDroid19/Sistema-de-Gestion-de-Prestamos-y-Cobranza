const { AuthorizationError } = require('../../../../utils/errorHandler');
const { calculateForecast, calculateTrend, calculateMovingAverage } = require('./statistics');

const ensureAdmin = (actor) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can access financial reports');
  }
};

const formatMoney = (value) => Number(value || 0).toFixed(2);
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/**
 * Create use case: Get Forecast Analysis
 * Returns earnings forecast using linear regression.
 * GET /api/reports/forecast-analysis?year={year}
 */
const createGetForecastAnalysis = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor);

  const targetYear = year || new Date().getFullYear();
  const monthlyData = await reportRepository.getMonthlyEarnings(targetYear);

  // Build earnings array aligned to months
  const earningsByMonth = {};
  monthlyData.forEach((m) => {
    if (m.month) earningsByMonth[m.month] = m.totalEarnings;
  });

  const monthlyEarnings = MONTHS.map((m) => {
    const monthKey = `${targetYear}-${m}`;
    return earningsByMonth[monthKey] || 0;
  });

  const forecast = calculateForecast(monthlyEarnings);
  const trend = calculateTrend(monthlyEarnings);
  const movingAverages = calculateMovingAverage(monthlyEarnings, 3);

  return {
    success: true,
    data: {
      year: targetYear,
      historicalData: monthlyEarnings.map((e, i) => ({
        month: `${targetYear}-${MONTHS[i]}`,
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
