const {
  ensureAdmin,
  formatMoney,
  parseDateRange,
  buildPaymentDateWhere,
} = require('@/modules/reports/application/reportHelpers');

/**
 * Get all payouts (payments) across all credits with optional filtering.
 * @param {object} dependencies
 * @returns {object} use case
 */
const createGetPayoutsReport = ({ reportRepository, paymentRepository }) => async ({ actor, pagination, filters = {} }) => {
  ensureAdmin(actor, 'Only admins can access the payouts report');

  const { fromDate, toDate, status, paymentType } = filters;
  const dateRange = parseDateRange({ fromDate, toDate });

  const statusWhere = status ? { status } : { status: 'completed' };
  const paymentTypeWhere = paymentType ? { paymentType } : {};

  const whereClause = {
    ...statusWhere,
    ...paymentTypeWhere,
    ...buildPaymentDateWhere(dateRange),
  };

  // Get paginated payments
  const payouts = await paymentRepository.listPayoutsReport({ ...whereClause, pagination });

  // Calculate summary statistics
  const allPayouts = payouts.items || payouts;
  const totalAmount = allPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPrincipal = allPayouts.reduce((sum, p) => sum + Number(p.principalApplied || 0), 0);
  const totalInterest = allPayouts.reduce((sum, p) => sum + Number(p.interestApplied || 0), 0);
  const totalPenalties = allPayouts.reduce((sum, p) => sum + Number(p.penaltyApplied || 0), 0);

  return {
    success: true,
    count: payouts.pagination?.totalItems ?? allPayouts.length,
    summary: {
      totalPayouts: allPayouts.length,
      totalAmount: formatMoney(totalAmount),
      totalPrincipal: formatMoney(totalPrincipal),
      totalInterest: formatMoney(totalInterest),
      totalPenalties: formatMoney(totalPenalties),
    },
    data: {
      payouts: allPayouts,
      ...(payouts.pagination ? { pagination: payouts.pagination } : {}),
    },
  };
};

module.exports = {
  createGetPayoutsReport,
};
