const { AuthorizationError, ValidationError } = require('@/utils/errorHandler');
const { formatCurrency, formatCurrencyDisplay } = require('@/modules/shared/money');
const { buildDateRangeMessage, normalizeOptionalOperationalDate } = require('@/modules/shared/dateUtils');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const isBackofficeActor = (actor) => actor?.role === 'admin' || actor?.role === 'employee';

/**
 * Require an authenticated administrative backoffice actor.
 * Employees must still pass route-level permission checks before reaching
 * use cases that call this helper.
 *
 * @param {{ role?: string }} actor
 * @param {string} [message]
 * @throws {AuthorizationError}
 * @returns {void}
 */
const ensureAdmin = (actor, message = 'Solo usuarios administrativos autorizados pueden acceder a reportes.') => {
  if (!isBackofficeActor(actor)) {
    throw new AuthorizationError(message);
  }
};

const formatMoney = formatCurrency;
const formatDisplayMoney = formatCurrencyDisplay;

const assertDateRangeOrder = ({ fromDate, toDate }, { fromLabel = 'fromDate', toLabel = 'toDate' } = {}) => {
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new ValidationError(buildDateRangeMessage(fromLabel, toLabel));
  }
};

const parseDateRange = ({ fromDate, toDate } = {}) => {
  const range = {
    fromDate: normalizeOptionalOperationalDate(fromDate, 'fromDate'),
    toDate: normalizeOptionalOperationalDate(toDate, 'toDate'),
  };
  assertDateRangeOrder(range);
  return range;
};

const buildPaymentDateWhere = (range = {}) => {
  const paymentDateWhere = {};

  if (range.fromDate) {
    paymentDateWhere.gte = range.fromDate;
  }

  if (range.toDate) {
    paymentDateWhere.lte = range.toDate;
  }

  return Object.keys(paymentDateWhere).length > 0
    ? { paymentDate: paymentDateWhere }
    : {};
};

const parseOptionalReportId = (value, fieldName = 'id') => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!validateIntegerId(value)) {
    throw new ValidationError(buildInvalidIntegerIdMessage(fieldName));
  }

  return Number(String(value).trim());
};

const normalizePayoutStatusFilter = (status) => {
  if (!status) {
    return status;
  }

  return status === 'reversed' ? 'annulled' : status;
};

const mapMonthlySeries = ({ year, rows, valueKey }) => {
  const valuesByMonth = {};
  rows.forEach((row) => {
    if (row.month) {
      valuesByMonth[row.month] = Number(row[valueKey] || 0);
    }
  });

  return MONTHS.map((month) => {
    const monthKey = `${year}-${month}`;
    return {
      month: monthKey,
      value: valuesByMonth[monthKey] || 0,
    };
  });
};

const buildCsv = ({ headers, rows }) => {
  const escapeCell = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replaceAll('"', '""')}"`;
    }
    return stringValue;
  };

  return [headers.join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\n');
};

module.exports = {
  MONTHS,
  ensureAdmin,
  assertDateRangeOrder,
  formatMoney,
  formatDisplayMoney,
  parseDateRange,
  buildPaymentDateWhere,
  parseOptionalReportId,
  normalizePayoutStatusFilter,
  mapMonthlySeries,
  buildCsv,
};
