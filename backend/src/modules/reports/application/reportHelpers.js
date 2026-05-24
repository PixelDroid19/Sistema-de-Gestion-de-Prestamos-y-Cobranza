const { AuthorizationError } = require('@/utils/errorHandler');
const { formatCurrency } = require('@/modules/shared/money');
const { normalizeOptionalOperationalDate } = require('@/modules/shared/dateUtils');

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
const ensureAdmin = (actor, message = 'Only authorized backoffice users can access reports') => {
  if (!isBackofficeActor(actor)) {
    throw new AuthorizationError(message);
  }
};

const formatMoney = formatCurrency;

const parseDateRange = ({ fromDate, toDate } = {}) => {
  return {
    fromDate: normalizeOptionalOperationalDate(fromDate, 'fromDate'),
    toDate: normalizeOptionalOperationalDate(toDate, 'toDate'),
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

const escapePdfText = (value) => String(value)
  .replaceAll('\\', '\\\\')
  .replaceAll('(', '\\(')
  .replaceAll(')', '\\)');

const buildPdfTextStream = ({ title, lines }) => {
  const commands = [
    'BT',
    '/F1 18 Tf',
    '50 780 Td',
    `(${escapePdfText(title)}) Tj`,
    '0 -28 Td',
    '/F1 12 Tf',
  ];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('0 -18 Td');
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
};

const buildPdfBuffer = ({ title, lines }) => {
  const contentStream = buildPdfTextStream({ title, lines });
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

module.exports = {
  MONTHS,
  ensureAdmin,
  formatMoney,
  parseDateRange,
  buildPaymentDateWhere,
  mapMonthlySeries,
  buildCsv,
  buildPdfBuffer,
};
