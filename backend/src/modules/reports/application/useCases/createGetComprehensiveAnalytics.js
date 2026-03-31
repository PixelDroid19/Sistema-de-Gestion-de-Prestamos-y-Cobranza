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
 * Create use case: Get Comprehensive Analytics
 * Returns full financial analytics with all metrics.
 * GET /api/reports/comprehensive-analytics?year={year}
 */
const createGetComprehensiveAnalytics = ({ reportRepository, paymentRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor);

  const targetYear = year || new Date().getFullYear();
  const metrics = await reportRepository.getPerformanceMetrics(targetYear);
  const monthlyEarnings = await reportRepository.getMonthlyEarnings(targetYear);
  const monthlyInterest = await paymentRepository.getMonthlyInterest(targetYear);

  // Build monthly maps
  const earningsByMonth = {};
  monthlyEarnings.forEach((m) => {
    if (m.month) earningsByMonth[m.month] = m.totalEarnings;
  });

  const interestByMonth = {};
  monthlyInterest.forEach((m) => {
    if (m.month) interestByMonth[m.month] = m.interest;
  });

  // Calculate YoY change
  const prevYearMetrics = await reportRepository.getPerformanceMetrics(targetYear - 1);

  const months = MONTHS.map((m) => {
    const monthKey = `${targetYear}-${m}`;
    return {
      month: monthKey,
      totalEarnings: earningsByMonth[monthKey] || 0,
      totalInterest: interestByMonth[monthKey] || 0,
    };
  });

  const earningsValues = months.map((m) => m.totalEarnings);
  const movingAverages = calculateMovingAverage(earningsValues, 3);

  const monthsWithAnalysis = months.map((m, i) => {
    const prevEarnings = i > 0 ? months[i - 1].totalEarnings : 0;
    return {
      month: m.month,
      totalEarnings: formatMoney(m.totalEarnings),
      totalInterest: formatMoney(m.totalInterest),
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
        profitMargin: metrics.totalLoanAmount > 0
          ? formatMoney((metrics.totalInterest / metrics.totalLoanAmount) * 100)
          : '0.00',
      },
      yearOverYear: {
        previousYearEarnings: formatMoney(prevYearMetrics.totalEarnings),
        earningsChange: calculateChangePercent(metrics.totalEarnings, prevYearMetrics.totalEarnings),
      },
      monthlyDetails: monthsWithAnalysis,
    },
  };
};

module.exports = { createGetComprehensiveAnalytics };
