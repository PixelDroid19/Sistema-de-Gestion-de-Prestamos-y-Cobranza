const { ensureAdmin, formatMoney, mapMonthlySeries } = require('@/modules/reports/application/reportHelpers');

/**
 * Create use case: Get Monthly Interest Report
 * Returns monthly interest breakdown for a given year.
 * GET /api/reports/monthly-interest?year={year}
 */
const createGetMonthlyInterest = ({ paymentRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access financial reports');

  const targetYear = year || new Date().getFullYear();
  const monthlyData = await paymentRepository.getMonthlyInterest(targetYear);
  const months = mapMonthlySeries({
    year: targetYear,
    rows: monthlyData,
    valueKey: 'interest',
  }).map((entry) => ({ month: entry.month, interest: entry.value }));

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
