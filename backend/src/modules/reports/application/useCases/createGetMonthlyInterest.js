const { AuthorizationError } = require('../../../../utils/errorHandler');

const ensureAdmin = (actor) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can access financial reports');
  }
};

const formatMoney = (value) => Number(value || 0).toFixed(2);
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/**
 * Create use case: Get Monthly Interest Report
 * Returns monthly interest breakdown for a given year.
 * GET /api/reports/monthly-interest?year={year}
 */
const createGetMonthlyInterest = ({ paymentRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor);

  const targetYear = year || new Date().getFullYear();
  const monthlyData = await paymentRepository.getMonthlyInterest(targetYear);

  // Fill in missing months with zeros
  const interestByMonth = {};
  monthlyData.forEach((m) => {
    if (m.month) {
      interestByMonth[m.month] = m.interest;
    }
  });

  const months = MONTHS.map((m) => {
    const monthKey = `${targetYear}-${m}`;
    return {
      month: monthKey,
      interest: interestByMonth[monthKey] || 0,
    };
  });

  const totalInterest = months.reduce((sum, m) => sum + m.interest, 0);

  return {
    success: true,
    data: {
      year: targetYear,
      totalInterest: formatMoney(totalInterest),
      months: months.map((m) => ({
        month: m.month,
        interest: formatMoney(m.interest),
      })),
    },
  };
};

module.exports = { createGetMonthlyInterest };
