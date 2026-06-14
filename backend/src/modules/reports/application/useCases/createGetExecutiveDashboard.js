const { calculateTrend, calculateMovingAverage } = require('./statistics');
const { ensureAdmin, formatMoney, mapMonthlySeries } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Executive Dashboard
 * Returns high-level KPIs for executive view.
 * GET /api/reports/executive-dashboard
 */
const createGetExecutiveDashboard = ({ reportRepository, paymentRepository }) => async ({ actor }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder a reportes financieros.');

  const currentYear = new Date().getFullYear();
  const currentMetrics = await reportRepository.getPerformanceMetrics(currentYear);
  const prevYearMetrics = await reportRepository.getPerformanceMetrics(currentYear - 1);
  const monthlyData = await reportRepository.getMonthlyEarnings(currentYear);

  const monthlySeries = mapMonthlySeries({ year: currentYear, rows: monthlyData, valueKey: 'totalEarnings' });
  const monthlyEarnings = monthlySeries.map((entry) => entry.value);
  const monthlyDetailsByMonth = monthlyData.reduce((accumulator, entry) => {
    if (entry?.month) {
      accumulator[entry.month] = entry;
    }
    return accumulator;
  }, {});

  const movingAvg = calculateMovingAverage(monthlyEarnings, 3);
  const overallTrend = calculateTrend(monthlyEarnings);

  return {
    success: true,
    data: {
      period: currentYear,
      summary: {
        totalEarnings: formatMoney(currentMetrics.totalEarnings),
        totalInterest: formatMoney(currentMetrics.totalInterest),
        totalPenalties: formatMoney(currentMetrics.totalPenalties),
        paymentCount: currentMetrics.paymentCount,
        totalActiveLoans: currentMetrics.totalLoans,
        portfolioAmount: formatMoney(currentMetrics.totalLoanAmount),
      },
      previousYear: {
        totalEarnings: formatMoney(prevYearMetrics.totalEarnings),
        totalInterest: formatMoney(prevYearMetrics.totalInterest),
        paymentCount: prevYearMetrics.paymentCount,
      },
      trends: {
        earningsTrend: overallTrend,
        earningsMovingAverage: formatMoney(movingAvg[movingAvg.length - 1] || 0),
      },
      monthlyEarnings: monthlySeries.map((entry) => {
        const monthDetails = monthlyDetailsByMonth[entry.month] || {};
        return {
          month: entry.month,
          earnings: formatMoney(entry.value),
          interest: formatMoney(monthDetails.totalInterest || 0),
          penalties: formatMoney(monthDetails.totalPenalties || 0),
        };
      }),
    },
  };
};

module.exports = { createGetExecutiveDashboard };
