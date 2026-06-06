const {
  ensureAdmin,
  formatMoney,
  parseDateRange,
  buildPaymentDateWhere,
  parseOptionalReportId,
  normalizePayoutStatusFilter,
} = require('@/modules/reports/application/reportHelpers');

const toFiniteAmount = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const toOperationalDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const startOfUtcWeek = (date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(start, diff);
};

const buildBucket = (key, label) => ({
  key,
  label,
  installmentCount: 0,
  totalAmount: 0,
  totalPrincipal: 0,
  totalInterest: 0,
  totalPenalties: 0,
});

const addPaymentToBucket = (bucket, payment) => {
  bucket.installmentCount += 1;
  bucket.totalAmount += toFiniteAmount(payment.amount);
  bucket.totalPrincipal += toFiniteAmount(payment.principalApplied);
  bucket.totalInterest += toFiniteAmount(payment.interestApplied);
  bucket.totalPenalties += toFiniteAmount(payment.penaltyApplied);
};

const formatBucket = (bucket) => ({
  key: bucket.key,
  label: bucket.label,
  installmentCount: bucket.installmentCount,
  totalAmount: formatMoney(bucket.totalAmount),
  totalPrincipal: formatMoney(bucket.totalPrincipal),
  totalInterest: formatMoney(bucket.totalInterest),
  totalPenalties: formatMoney(bucket.totalPenalties),
});

const groupInstallmentCollections = (payments = []) => {
  const buckets = {
    daily: new Map(),
    weekly: new Map(),
    monthly: new Map(),
  };

  payments
    .filter((payment) => payment?.status === 'completed')
    .filter((payment) => payment?.paymentType === 'installment')
    .forEach((payment) => {
      const paymentDate = toOperationalDate(payment.paymentDate);
      if (!paymentDate) return;

      const dayKey = toDateKey(paymentDate);
      const monthKey = dayKey.slice(0, 7);
      const weekStart = startOfUtcWeek(paymentDate);
      const weekEnd = addDays(weekStart, 6);
      const weekKey = toDateKey(weekStart);
      const weekLabel = `${toDateKey(weekStart)} / ${toDateKey(weekEnd)}`;

      if (!buckets.daily.has(dayKey)) {
        buckets.daily.set(dayKey, buildBucket(dayKey, dayKey));
      }
      if (!buckets.weekly.has(weekKey)) {
        buckets.weekly.set(weekKey, buildBucket(weekKey, weekLabel));
      }
      if (!buckets.monthly.has(monthKey)) {
        buckets.monthly.set(monthKey, buildBucket(monthKey, monthKey));
      }

      addPaymentToBucket(buckets.daily.get(dayKey), payment);
      addPaymentToBucket(buckets.weekly.get(weekKey), payment);
      addPaymentToBucket(buckets.monthly.get(monthKey), payment);
    });

  const sortBuckets = (left, right) => String(right.key).localeCompare(String(left.key));

  return {
    daily: Array.from(buckets.daily.values()).sort(sortBuckets).map(formatBucket),
    weekly: Array.from(buckets.weekly.values()).sort(sortBuckets).map(formatBucket),
    monthly: Array.from(buckets.monthly.values()).sort(sortBuckets).map(formatBucket),
  };
};

/**
 * Get all payouts (payments) across all credits with optional filtering.
 * @param {object} dependencies
 * @returns {object} use case
 */
const createGetPayoutsReport = ({ reportRepository, paymentRepository }) => async ({ actor, pagination, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder al reporte de pagos.');

  const { fromDate, toDate, status, paymentType, employeeId } = filters;
  const dateRange = parseDateRange({ fromDate, toDate });
  const normalizedStatus = normalizePayoutStatusFilter(status);
  const normalizedEmployeeId = parseOptionalReportId(employeeId, 'employeeId');

  const statusWhere = normalizedStatus ? { status: normalizedStatus } : { status: 'completed' };
  const paymentTypeWhere = paymentType ? { paymentType } : {};
  const employeeWhere = normalizedEmployeeId ? { createdByUserId: normalizedEmployeeId } : {};

  const whereClause = {
    ...statusWhere,
    ...paymentTypeWhere,
    ...employeeWhere,
    ...buildPaymentDateWhere(dateRange),
  };

  // Get paginated payments
  const payouts = await paymentRepository.listPayoutsReport({ ...whereClause, pagination });
  const filteredPayouts = await paymentRepository.listPayoutsReport(whereClause);

  // Calculate summary statistics
  const pagePayouts = payouts.items || payouts;
  const allPayouts = filteredPayouts.items || filteredPayouts;
  const totalAmount = allPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPrincipal = allPayouts.reduce((sum, p) => sum + Number(p.principalApplied || 0), 0);
  const totalInterest = allPayouts.reduce((sum, p) => sum + Number(p.interestApplied || 0), 0);
  const totalPenalties = allPayouts.reduce((sum, p) => sum + Number(p.penaltyApplied || 0), 0);
  const collectionBreakdown = groupInstallmentCollections(allPayouts);

  return {
    success: true,
    count: payouts.pagination?.totalItems ?? pagePayouts.length,
    summary: {
      totalPayouts: allPayouts.length,
      totalAmount: formatMoney(totalAmount),
      totalPrincipal: formatMoney(totalPrincipal),
      totalInterest: formatMoney(totalInterest),
      totalPenalties: formatMoney(totalPenalties),
      collectionBreakdown,
    },
    data: {
      payouts: pagePayouts,
      ...(payouts.pagination ? { pagination: payouts.pagination } : {}),
    },
  };
};

module.exports = {
  createGetPayoutsReport,
  groupInstallmentCollections,
};
