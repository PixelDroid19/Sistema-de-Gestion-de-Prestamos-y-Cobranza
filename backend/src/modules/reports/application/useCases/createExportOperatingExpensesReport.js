const {
  ensureAdmin,
  formatMoney,
  parseDateRange,
  buildPdfBuffer,
} = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus } = require('@/modules/reports/application/reportLabels');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const { ValidationError } = require('@/utils/errorHandler');

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(['completed', 'annulled']);

const EXPENSE_COLUMNS = [
  { header: 'Gasto', key: 'expenseId', width: 12 },
  { header: 'Fecha', key: 'expenseDate', width: 18, numFmt: 'dd/mm/yyyy' },
  { header: 'Categoría', key: 'category', width: 24 },
  { header: 'Descripción', key: 'description', width: 34 },
  { header: 'Monto', key: 'amount', width: 18, numFmt: '"$"#,##0.00' },
  { header: 'Medio de Pago', key: 'paymentMethod', width: 20 },
  { header: 'Estado', key: 'status', width: 16 },
  { header: 'Referencia', key: 'reference', width: 22 },
  { header: 'Registrado por', key: 'createdBy', width: 24 },
  { header: 'Anulado por', key: 'annulledBy', width: 24 },
  { header: 'Fecha de Anulación', key: 'annulledAt', width: 22, numFmt: 'dd/mm/yyyy' },
  { header: 'Motivo de Anulación', key: 'annulmentReason', width: 34 },
];

const formatIsoDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const endOfUtcDay = (date) => {
  if (!date) {
    return null;
  }

  const endDate = new Date(date.getTime());
  endDate.setUTCHours(23, 59, 59, 999);
  return endDate;
};

const normalizeStatus = (status) => {
  if (status === undefined || status === null || status === '') {
    return null;
  }

  const normalized = String(status).trim().toLowerCase();
  if (!VALID_STATUSES.has(normalized)) {
    throw new ValidationError('status must be completed or annulled');
  }

  return normalized;
};

const assertDateRangeOrder = ({ fromDate, toDate }) => {
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new ValidationError('fromDate must be before or equal to toDate');
  }
};

const normalizeExportFilters = (filters = {}) => {
  const rawToDate = String(filters.toDate || filters.endDate || '').trim();
  const dateRange = parseDateRange({
    fromDate: filters.fromDate || filters.startDate,
    toDate: filters.toDate || filters.endDate,
  });
  assertDateRangeOrder(dateRange);

  return {
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate && DATE_ONLY_PATTERN.test(rawToDate)
      ? endOfUtcDay(dateRange.toDate)
      : dateRange.toDate,
    status: normalizeStatus(filters.status),
  };
};

const pickUserName = (user) => user?.name || user?.email || 'N/A';

const buildExpenseRows = (expenses = []) => expenses.map((expense) => ({
  expenseId: expense.id,
  expenseDate: formatIsoDate(expense.expenseDate),
  category: expense.category || 'N/A',
  description: expense.description || 'N/A',
  amount: toNumber(expense.amount),
  paymentMethod: expense.paymentMethod || 'N/A',
  status: formatOperationalStatus(expense.status),
  reference: expense.reference || '',
  createdBy: pickUserName(expense.createdBy),
  annulledBy: expense.annulledBy ? pickUserName(expense.annulledBy) : '',
  annulledAt: formatIsoDate(expense.annulledAt),
  annulmentReason: expense.annulmentReason || '',
}));

const buildOperatingExpenseSheets = (rows) => [{
  name: 'Gastos Operativos',
  title: 'REPORTE DE GASTOS OPERATIVOS',
  tabColor: STYLE_COLORS.red,
  headerFill: STYLE_COLORS.headerBlue,
  columns: EXPENSE_COLUMNS,
  rows,
}];

const buildOperatingExpensePdf = (rows) => {
  const total = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const lines = [
    `Registros incluidos: ${rows.length}`,
    `Total reportado: $${formatMoney(total)}`,
    '',
    ...rows.map((row) => `${row.expenseDate || 'Sin fecha'} - ${row.category}: $${formatMoney(row.amount)} - ${row.status}`),
  ].slice(0, 42);

  return buildPdfBuffer({
    title: 'Gastos operativos',
    lines,
  });
};

const createExportOperatingExpensesReport = ({ reportRepository }) => async ({ actor, filters = {}, format = 'xlsx' }) => {
  ensureAdmin(actor, 'Only authorized backoffice users can export operating expense reports');
  const normalizedFormat = String(format || 'xlsx').trim().toLowerCase();
  if (!['xlsx', 'excel', 'pdf'].includes(normalizedFormat)) {
    throw new ValidationError('format must be xlsx or pdf');
  }

  const normalizedFilters = normalizeExportFilters(filters);
  const expenses = await reportRepository.listOperatingExpensesForReport(normalizedFilters);
  const rows = buildExpenseRows(expenses);
  const date = new Date().toISOString().slice(0, 10);

  if (normalizedFormat === 'pdf') {
    return {
      fileName: `gastos-operativos-${date}.pdf`,
      contentType: 'application/pdf',
      buffer: buildOperatingExpensePdf(rows),
    };
  }

  return {
    fileName: `gastos-operativos-${date}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: buildOperatingExpenseSheets(rows),
  };
};

module.exports = {
  createExportOperatingExpensesReport,
  buildExpenseRows,
  normalizeExportFilters,
};
