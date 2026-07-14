const { buildReportPdf } = require('@/modules/shared/pdfReport');
const {
  ensureAdmin,
  formatDisplayMoney,
  parseDateRange,
  buildPaymentDateWhere,
  parseOptionalReportId,
  normalizePayoutStatusFilter,
} = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus, formatPaymentMethod, formatPaymentType } = require('@/modules/reports/application/reportLabels');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const { MONEY_FORMAT, roundMoney, toExcelDate } = require('@/modules/reports/application/excelExportFormats');

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: MONEY_FORMAT });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: 'dd/mm/yyyy' });

const PAYOUT_WORKBOOK_COLUMNS = [
  { header: 'Pago', key: 'paymentId', width: 12 },
  { header: 'Crédito', key: 'loanId', width: 12 },
  { header: 'Referencia cliente', key: 'customerId', width: 18 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  dateColumn('Fecha de Pago', 'paymentDate', 18),
  moneyColumn('Monto', 'amount'),
  moneyColumn('Capital Aplicado', 'principalApplied', 20),
  moneyColumn('Interés Aplicado', 'interestApplied', 20),
  moneyColumn('Mora Aplicada', 'penaltyApplied', 18),
  moneyColumn('Saldo Después del Pago', 'remainingBalanceAfterPayment', 22),
  { header: 'Tipo Pago', key: 'paymentType', width: 16 },
  { header: 'Método', key: 'paymentMethod', width: 18 },
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Registrado por', key: 'createdBy', width: 28 },
  { header: 'Referencia', key: 'reference', width: 22 },
  { header: 'Observación', key: 'observation', width: 30 },
  { header: 'Comprobante', key: 'voucherNumber', width: 18 },
  dateColumn('Fecha Registro', 'createdAt', 18),
];

const formatIsoDate = (value) => {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toISOString().slice(0, 10);
};

const toWorkbookMoney = (value) => roundMoney(value);
const toWorkbookDate = (value) => value === 'Sin fecha' ? value : toExcelDate(value);

const normalizePayoutExportFilters = (filters = {}) => {
  const dateRange = parseDateRange({
    fromDate: filters.fromDate ?? filters.startDate,
    toDate: filters.toDate ?? filters.endDate,
  });

  return {
    loanId: filters.loanId ?? filters.creditId,
    status: normalizePayoutStatusFilter(filters.status) || 'completed',
    paymentType: filters.paymentType,
    customerId: filters.customerId,
    createdByUserId: parseOptionalReportId(filters.employeeId ?? filters.createdByUserId, 'employeeId'),
    ...buildPaymentDateWhere(dateRange),
  };
};

const compactWhereClause = (filters) => Object.entries(filters)
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

const resolveCustomer = (payment) => payment?.Loan?.Customer || payment?.Loan?.customer || null;
const resolvePaymentCreator = (payment) => payment?.createdBy || payment?.CreatedBy || null;

const parseMoneyValue = (value) => {
  const normalized = Number(String(value ?? 0).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(normalized) ? normalized : 0;
};

const sumRowsByMoneyKey = (rows, key) => rows.reduce((sum, row) => sum + parseMoneyValue(row[key]), 0);

const buildPayoutExportRows = async ({ paymentRepository, filters }) => {
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

  return payments.map((payment) => {
    const customer = resolveCustomer(payment);
    const createdBy = resolvePaymentCreator(payment);

    return {
      paymentId: payment.id,
      loanId: payment.loanId,
      customerId: customer?.id || payment?.Loan?.customerId || 'Sin referencia',
      customerName: customer?.name || 'Cliente no disponible',
      customerEmail: customer?.email || 'Sin correo registrado',
      paymentDate: formatIsoDate(payment.paymentDate),
      amount: toWorkbookMoney(payment.amount),
      principalApplied: toWorkbookMoney(payment.principalApplied),
      interestApplied: toWorkbookMoney(payment.interestApplied),
      penaltyApplied: toWorkbookMoney(payment.penaltyApplied),
      remainingBalanceAfterPayment: toWorkbookMoney(payment.remainingBalanceAfterPayment),
      paymentType: formatPaymentType(payment.paymentType),
      paymentMethod: formatPaymentMethod(payment.paymentMethod),
      status: formatOperationalStatus(payment.status),
      createdBy: createdBy?.name || createdBy?.email || 'Registro histórico',
      reference: payment.paymentMetadata?.reference || '',
      observation: payment.paymentMetadata?.observation || '',
      voucherNumber: payment.paymentMetadata?.voucherNumber || '',
      createdAt: formatIsoDate(payment.createdAt),
    };
  });
};

/**
 * Build the production Excel dataset for payment exports.
 *
 * @param {object} dependencies
 * @param {object} dependencies.paymentRepository Repository with listPayoutsReport.
 * @returns {Function} use case function.
 */
const createExportPayoutsExcel = ({ paymentRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden exportar datos de pagos.');

  const rows = await buildPayoutExportRows({ paymentRepository, filters });

  return {
    success: true,
    data: {
      rows,
      sheets: [{
        name: 'Pagos',
        title: 'REPORTE DE PAGOS',
        tabColor: STYLE_COLORS.green,
        headerFill: STYLE_COLORS.green,
        columns: PAYOUT_WORKBOOK_COLUMNS,
        rows: rows.map((row) => ({
          ...row,
          paymentDate: toWorkbookDate(row.paymentDate),
          createdAt: toWorkbookDate(row.createdAt),
        })),
      }],
    },
  };
};

const createExportPayoutsPdf = ({ paymentRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden exportar datos de pagos.');

  const rows = await buildPayoutExportRows({ paymentRepository, filters });

  return {
    fileName: 'reporte-pagos.pdf',
    contentType: 'application/pdf',
    buffer: await buildReportPdf({
      title: 'Pago de cuotas',
      subtitle: 'Pagos y movimientos recibidos en el rango seleccionado.',
      summary: [
        { label: 'Pagos incluidos', value: rows.length },
        { label: 'Total recibido', value: formatDisplayMoney(sumRowsByMoneyKey(rows, 'amount')) },
        { label: 'Capital aplicado', value: formatDisplayMoney(sumRowsByMoneyKey(rows, 'principalApplied')) },
        { label: 'Interés aplicado', value: formatDisplayMoney(sumRowsByMoneyKey(rows, 'interestApplied')) },
        { label: 'Mora aplicada', value: formatDisplayMoney(sumRowsByMoneyKey(rows, 'penaltyApplied')) },
      ],
      sections: [{
        heading: 'Detalle de pagos',
        table: {
          columns: [
            { header: 'Fecha', key: 'paymentDate', width: 70 },
            { header: 'Cliente', key: 'customerName' },
            { header: 'Crédito', key: 'loanId', width: 50 },
            { header: 'Movimiento', key: 'paymentType', width: 85 },
            { header: 'Monto', key: 'amount', width: 85, align: 'right', bold: true },
            { header: 'Capital', key: 'principalApplied', width: 80, align: 'right' },
          ],
          rows: rows.map((row) => ({
            paymentDate: row.paymentDate,
            customerName: row.customerName,
            loanId: `#${row.loanId}`,
            paymentType: row.paymentType,
            amount: formatDisplayMoney(row.amount),
            principalApplied: formatDisplayMoney(row.principalApplied),
          })),
        },
      }],
    }),
  };
};

module.exports = {
  createExportPayoutsExcel,
  createExportPayoutsPdf,
};
