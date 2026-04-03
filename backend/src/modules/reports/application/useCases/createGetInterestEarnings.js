const { ensureAdmin, formatMoney } = require('../reportHelpers');

/**
 * Create use case: Get Interest Earnings Report
 * Returns interest earnings broken down by month.
 * GET /api/reports/interest-earnings
 */
const createGetInterestEarnings = ({ paymentRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const monthlyInterest = await paymentRepository.getMonthlyInterest(targetYear);

  const totalInterest = monthlyInterest.reduce((sum, m) => sum + m.interest, 0);

  return {
    success: true,
    data: {
      totalInterest: formatMoney(totalInterest),
      byMonth: monthlyInterest.map((m) => ({
        month: m.month,
        interest: formatMoney(m.interest),
      })),
    },
  };
};

module.exports = { createGetInterestEarnings };
