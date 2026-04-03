const { AuthorizationError } = require('../../../utils/errorHandler');

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const ensureAdmin = (actor, message = 'Only admins can access reports') => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError(message);
  }
};

const ensureAdminOrSocio = (actor, message = 'Only admins and socios can access reports') => {
  if (actor?.role !== 'admin' && actor?.role !== 'socio') {
    throw new AuthorizationError(message);
  }
};

const formatMoney = (value) => Number(value || 0).toFixed(2);

const parseDateRange = ({ fromDate, toDate } = {}) => {
  const parsedFromDate = fromDate ? new Date(fromDate) : null;
  const parsedToDate = toDate ? new Date(toDate) : null;

  return {
    fromDate: parsedFromDate && !Number.isNaN(parsedFromDate.getTime()) ? parsedFromDate : null,
    toDate: parsedToDate && !Number.isNaN(parsedToDate.getTime()) ? parsedToDate : null,
  };
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

module.exports = {
  MONTHS,
  ensureAdmin,
  ensureAdminOrSocio,
  formatMoney,
  parseDateRange,
  buildPaymentDateWhere,
  mapMonthlySeries,
};
