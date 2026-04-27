const {
  ensureAdmin,
  formatMoney,
  parseDateRange,
  buildPaymentDateWhere,
} = require('@/modules/reports/application/reportHelpers');

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const normalizePayoutExportFilters = (filters = {}) => {
  const dateRange = parseDateRange({
    fromDate: filters.fromDate ?? filters.startDate,
    toDate: filters.toDate ?? filters.endDate,
  });

  return {
    loanId: filters.loanId ?? filters.creditId,
    status: filters.status || 'completed',
    paymentType: filters.paymentType,
    customerId: filters.customerId,
    ...buildPaymentDateWhere(dateRange),
  };
};

const compactWhereClause = (filters) => Object.entries(filters)
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

const resolveCustomer = (payment) => payment?.Loan?.Customer || payment?.Loan?.customer || null;

/**
 * Build the production Excel dataset for payment exports.
 *
 * @param {object} dependencies
 * @param {object} dependencies.paymentRepository Repository with listPayoutsReport.
 * @returns {Function} use case function.
 */
const createExportPayoutsExcel = ({ paymentRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Only admins can export payment data');

  const normalizedFilters = normalizePayoutExportFilters(filters);
  const customerId = normalizedFilters.customerId ? Number(normalizedFilters.customerId) : null;
  const { customerId: _customerId, ...paymentFilters } = normalizedFilters;
  const payouts = await paymentRepository.listPayoutsReport({
    ...compactWhereClause(paymentFilters),
    pagination: null,
  });
  const payments = (payouts.items || []).filter((payment) => {
    if (!customerId) {
      return true;
    }

    const customer = resolveCustomer(payment);
    return Number(customer?.id || payment?.Loan?.customerId) === customerId;
  });

  return {
    success: true,
    data: {
      rows: payments.map((payment) => {
        const customer = resolveCustomer(payment);

        return {
          paymentId: payment.id,
          loanId: payment.loanId,
          customerId: customer?.id || payment?.Loan?.customerId || 'N/A',
          customerName: customer?.name || 'N/A',
          customerEmail: customer?.email || 'N/A',
          paymentDate: formatIsoDate(payment.paymentDate),
          amount: formatMoney(payment.amount),
          principalApplied: formatMoney(payment.principalApplied),
          interestApplied: formatMoney(payment.interestApplied),
          penaltyApplied: formatMoney(payment.penaltyApplied),
          remainingBalanceAfterPayment: formatMoney(payment.remainingBalanceAfterPayment),
          paymentType: payment.paymentType || 'N/A',
          paymentMethod: payment.paymentMethod || payment.paymentMetadata?.method || 'N/A',
          status: payment.status || 'N/A',
          reference: payment.paymentMetadata?.reference || '',
          observation: payment.paymentMetadata?.observation || '',
          voucherNumber: payment.paymentMetadata?.voucherNumber || '',
          createdAt: formatIsoDate(payment.createdAt),
        };
      }),
    },
  };
};

module.exports = {
  createExportPayoutsExcel,
};
