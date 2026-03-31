const { AuthorizationError } = require('../../../../utils/errorHandler');
const { calculateTrend, calculateMovingAverage } = require('./statistics');

const ensureAdmin = (actor) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can access financial reports');
  }
};

const formatMoney = (value) => Number(value || 0).toFixed(2);
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/**
 * Create use case: Get Executive Dashboard
 * Returns high-level KPIs for executive view.
 * GET /api/reports/executive-dashboard
 */
const createGetExecutiveDashboard = ({ reportRepository, paymentRepository }) => async ({ actor }) => {
  ensureAdmin(actor);

  const currentYear = new Date().getFullYear();
  const currentMetrics = await reportRepository.getPerformanceMetrics(currentYear);
  const prevYearMetrics = await reportRepository.getPerformanceMetrics(currentYear - 1);
  const monthlyData = await reportRepository.getMonthlyEarnings(currentYear);

  // Build monthly map
  const earningsByMonth = {};
  monthlyData.forEach((m) => {
    if (m.month) {
      earningsByMonth[m.month] = m.totalEarnings;
    }
  });

  const monthlyEarnings = MONTHS.map((m) => {
    const monthKey = `${currentYear}-${m}`;
    return earningsByMonth[monthKey] || 0;
  });

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
      monthlyEarnings: monthlyEarnings.map((e, i) => ({
        month: `${currentYear}-${MONTHS[i]}`,
        earnings: formatMoney(e),
      })),
    },
  };
};

module.exports = { createGetExecutiveDashboard };
