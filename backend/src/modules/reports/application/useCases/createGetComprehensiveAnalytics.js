const { calculateTrend, calculateMovingAverage, calculateChangePercent } = require('./statistics');
const { ensureAdmin, formatMoney, mapMonthlySeries } = require('../reportHelpers');

/**
 * Create use case: Get Comprehensive Analytics
 * Returns full financial analytics with all metrics.
 * GET /api/reports/comprehensive-analytics?year={year}
 */
const createGetComprehensiveAnalytics = ({ reportRepository, paymentRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const metrics = await reportRepository.getPerformanceMetrics(targetYear);
  const monthlyEarnings = await reportRepository.getMonthlyEarnings(targetYear);
  const monthlyInterest = await paymentRepository.getMonthlyInterest(targetYear);

  const earningsSeries = mapMonthlySeries({ year: targetYear, rows: monthlyEarnings, valueKey: 'totalEarnings' });
  const interestSeries = mapMonthlySeries({ year: targetYear, rows: monthlyInterest, valueKey: 'interest' });
  const interestByMonth = interestSeries.reduce((map, entry) => {
    map[entry.month] = entry.value;
    return map;
  }, {});

  // Calculate YoY change
  const prevYearMetrics = await reportRepository.getPerformanceMetrics(targetYear - 1);

  const months = earningsSeries.map((entry) => {
    const monthKey = entry.month;
    return {
      month: monthKey,
      totalEarnings: entry.value,
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
