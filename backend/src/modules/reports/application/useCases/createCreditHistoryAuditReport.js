const { ensureAdmin, formatMoney, buildPdfBuffer } = require('@/modules/reports/application/reportHelpers');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const { normalizeOptionalOperationalDate, toDateOnlyOrNull, toOperationalDateOrNull } = require('@/modules/shared/dateUtils');
const { BadRequestError } = require('@/utils/errorHandler');

const MONEY_FORMAT = '"$" #,##0.00;[Red]-"$" #,##0.00;"-"';
const DATE_FORMAT = 'dd/mm/yyyy';
const INTEGER_FORMAT = '#,##0';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: MONEY_FORMAT });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: DATE_FORMAT });

const MONTHLY_HISTORY_COLUMNS = [
  { header: 'Mes', key: 'monthLabel', width: 18 },
  { header: 'Créditos Creados', key: 'creditsCreated', width: 18, numFmt: INTEGER_FORMAT },
  moneyColumn('Capital Prestado', 'createdPrincipal'),
  { header: 'Cuotas Recibidas', key: 'installmentsReceived', width: 18, numFmt: INTEGER_FORMAT },
  moneyColumn('Total Recibido', 'paymentsReceived'),
  moneyColumn('Capital Recuperado', 'capitalRecovered'),
  moneyColumn('Intereses Cobrados', 'interestCollected'),
  moneyColumn('Mora Cobrada', 'penaltiesCollected'),
  { header: 'Créditos Vencidos', key: 'overdueCredits', width: 18, numFmt: INTEGER_FORMAT },
  moneyColumn('Pérdidas/Riesgo', 'lossesAtRisk'),
  moneyColumn('Ganancias', 'gains'),
  moneyColumn('Caja Disponible', 'availableCash'),
];

const CREDIT_DETAIL_COLUMNS = [
  { header: 'ID Crédito', key: 'creditId', width: 12, numFmt: INTEGER_FORMAT },
  { header: 'Cliente', key: 'customerName', width: 28 },
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha Crédito', 'creditDate'),
  moneyColumn('Monto Préstamo', 'amount'),
  moneyColumn('Saldo Capital', 'principalOutstanding'),
  moneyColumn('Total Pagado', 'totalPaid'),
  moneyColumn('Interés Pagado', 'interestPaid'),
  moneyColumn('Mora Pagada', 'penaltyPaid'),
];

const PAYMENT_DETAIL_COLUMNS = [
  { header: 'ID Pago', key: 'paymentId', width: 12, numFmt: INTEGER_FORMAT },
  { header: 'ID Crédito', key: 'creditId', width: 12, numFmt: INTEGER_FORMAT },
  { header: 'Cliente', key: 'customerName', width: 28 },
  dateColumn('Fecha Pago', 'paymentDate'),
  { header: 'Tipo Pago', key: 'paymentType', width: 16 },
  { header: 'Estado', key: 'status', width: 14 },
  moneyColumn('Monto Recibido', 'amount'),
  moneyColumn('Capital Recuperado', 'principalApplied'),
  moneyColumn('Interés Cobrado', 'interestApplied'),
  moneyColumn('Mora Cobrada', 'penaltyApplied'),
];

const SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'indicator', width: 34 },
  { header: 'Valor', key: 'value', width: 22 },
];

const toPlain = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;

const toMoneyString = (value) => roundMoney(value).toFixed(2);

const pickLoanDate = (loan) => (
  loan.startDate
  || loan.approvedAt
  || loan.disbursedAt
  || loan.createdAt
);

const toMonthKey = (value) => {
  const date = toOperationalDateOrNull(value);
  if (!date) {
    return null;
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (monthKey) => {
  const [year, month] = String(monthKey).split('-');
  const monthIndex = Number(month) - 1;
  return `${MONTH_NAMES[monthIndex] || month} ${year}`;
};

const normalizeStatusFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const statuses = (Array.isArray(value) ? value : String(value).split(','))
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);

  return statuses.length > 0 ? statuses : null;
};

const parseMonthFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new BadRequestError('month must use YYYY-MM format');
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    throw new BadRequestError('month must use YYYY-MM format');
  }

  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { month: normalized, startDate, endDate };
};

const normalizeCreditHistoryFilters = (filters = {}) => {
  const monthFilter = parseMonthFilter(filters.month);
  const startDate = monthFilter?.startDate
    || normalizeOptionalOperationalDate(filters.startDate ?? filters.fromDate, 'startDate');
  const endDate = monthFilter?.endDate
    || normalizeOptionalOperationalDate(filters.endDate ?? filters.toDate, 'endDate');

  if (startDate && endDate && startDate > endDate) {
    throw new BadRequestError('startDate must be before or equal to endDate');
  }

  return {
    month: monthFilter?.month || null,
    startDate,
    endDate,
    status: normalizeStatusFilter(filters.status),
  };
};

const isOverdueLoan = (loan) => ['overdue', 'defaulted'].includes(String(loan.status || '').toLowerCase());

const getPrincipalOutstanding = (loan) => {
  const snapshot = loan.financialSnapshot || {};
  return toNumber(
    loan.principalOutstanding
    ?? snapshot.principalOutstanding
    ?? snapshot.remainingPrincipal
    ?? snapshot.outstandingBalance
    ?? loan.amount
  );
};

const getLoanCustomerName = (loan) => (
  loan.Customer?.name
  || loan.customer?.name
  || loan.customerName
  || `Cliente #${loan.customerId || 'N/A'}`
);

const getPaymentLoan = (payment) => payment.Loan || payment.loan || {};

const getPaymentCustomerName = (payment) => (
  getPaymentLoan(payment).Customer?.name
  || getPaymentLoan(payment).customer?.name
  || `Cliente #${getPaymentLoan(payment).customerId || 'N/A'}`
);

const makeEmptyMonth = (monthKey) => ({
  month: monthKey,
  monthLabel: monthLabel(monthKey),
  creditsCreated: 0,
  createdPrincipal: 0,
  installmentsReceived: 0,
  paymentsReceived: 0,
  capitalRecovered: 0,
  interestCollected: 0,
  penaltiesCollected: 0,
  overdueCredits: 0,
  lossesAtRisk: 0,
  gains: 0,
  availableCash: 0,
});

const getMonthRange = ({ loans, payments, filters }) => {
  const explicitMonths = [];
  if (filters.startDate && filters.endDate) {
    const cursor = new Date(Date.UTC(filters.startDate.getUTCFullYear(), filters.startDate.getUTCMonth(), 1));
    const last = new Date(Date.UTC(filters.endDate.getUTCFullYear(), filters.endDate.getUTCMonth(), 1));
    while (cursor <= last) {
      explicitMonths.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const observedMonths = [
    ...loans.map((loan) => toMonthKey(pickLoanDate(loan))),
    ...payments.map((payment) => toMonthKey(payment.paymentDate)),
  ].filter(Boolean);

  return Array.from(new Set([...explicitMonths, ...observedMonths])).sort();
};

const buildCreditHistoryAuditReport = ({ loans = [], payments = [], filters = {} }) => {
  const plainLoans = loans.map(toPlain);
  const plainPayments = payments.map(toPlain);
  const monthKeys = getMonthRange({ loans: plainLoans, payments: plainPayments, filters });
  const monthsByKey = new Map(monthKeys.map((month) => [month, makeEmptyMonth(month)]));

  plainLoans.forEach((loan) => {
    const month = toMonthKey(pickLoanDate(loan));
    if (!month || !monthsByKey.has(month)) {
      return;
    }

    const row = monthsByKey.get(month);
    row.creditsCreated += 1;
    row.createdPrincipal += toNumber(loan.amount);
    if (isOverdueLoan(loan)) {
      row.overdueCredits += 1;
      row.lossesAtRisk += getPrincipalOutstanding(loan);
    }
  });

  plainPayments.forEach((payment) => {
    const month = toMonthKey(payment.paymentDate);
    if (!month || !monthsByKey.has(month)) {
      return;
    }

    const row = monthsByKey.get(month);
    row.installmentsReceived += 1;
    row.paymentsReceived += toNumber(payment.amount);
    row.capitalRecovered += toNumber(payment.principalApplied);
    row.interestCollected += toNumber(payment.interestApplied);
    row.penaltiesCollected += toNumber(payment.penaltyApplied);
  });

  let accumulatedCash = 0;
  const months = Array.from(monthsByKey.values()).map((month) => {
    month.gains = month.interestCollected + month.penaltiesCollected;
    accumulatedCash += month.paymentsReceived - month.createdPrincipal;
    month.availableCash = accumulatedCash;

    return {
      ...month,
      createdPrincipal: toMoneyString(month.createdPrincipal),
      paymentsReceived: toMoneyString(month.paymentsReceived),
      capitalRecovered: toMoneyString(month.capitalRecovered),
      interestCollected: toMoneyString(month.interestCollected),
      penaltiesCollected: toMoneyString(month.penaltiesCollected),
      lossesAtRisk: toMoneyString(month.lossesAtRisk),
      gains: toMoneyString(month.gains),
      availableCash: toMoneyString(month.availableCash),
    };
  });

  const sum = (key) => toMoneyString(months.reduce((total, month) => total + toNumber(month[key]), 0));
  const count = (key) => months.reduce((total, month) => total + Number(month[key] || 0), 0);
  const summary = {
    creditsCreated: count('creditsCreated'),
    installmentsReceived: count('installmentsReceived'),
    totalPrincipalCreated: sum('createdPrincipal'),
    totalPaymentsReceived: sum('paymentsReceived'),
    totalCapitalRecovered: sum('capitalRecovered'),
    totalInterestCollected: sum('interestCollected'),
    totalPenaltiesCollected: sum('penaltiesCollected'),
    overdueCredits: count('overdueCredits'),
    lossesAtRisk: sum('lossesAtRisk'),
    gains: sum('gains'),
    availableCash: months.at(-1)?.availableCash || '0.00',
  };

  return {
    filters,
    summary,
    months,
    credits: plainLoans.map((loan) => ({
      creditId: loan.id,
      customerName: getLoanCustomerName(loan),
      status: loan.status || '',
      creditDate: toOperationalDateOrNull(pickLoanDate(loan)) || '',
      amount: roundMoney(loan.amount),
      principalOutstanding: roundMoney(getPrincipalOutstanding(loan)),
      totalPaid: roundMoney(loan.financialSnapshot?.totalPaid),
      interestPaid: roundMoney(loan.financialSnapshot?.interestPaid || loan.financialSnapshot?.totalInterestPaid),
      penaltyPaid: roundMoney(loan.financialSnapshot?.penaltyPaid || loan.financialSnapshot?.lateFeesPaid),
    })),
    payments: plainPayments.map((payment) => ({
      paymentId: payment.id,
      creditId: payment.loanId || getPaymentLoan(payment).id,
      customerName: getPaymentCustomerName(payment),
      paymentDate: toOperationalDateOrNull(payment.paymentDate) || '',
      paymentType: payment.paymentType || '',
      status: payment.status || '',
      amount: roundMoney(payment.amount),
      principalApplied: roundMoney(payment.principalApplied),
      interestApplied: roundMoney(payment.interestApplied),
      penaltyApplied: roundMoney(payment.penaltyApplied),
    })),
  };
};

const buildSummaryRows = (summary) => [
  { indicator: 'Créditos creados', value: summary.creditsCreated },
  { indicator: 'Cuotas recibidas', value: summary.installmentsReceived },
  { indicator: 'Capital prestado', value: Number(summary.totalPrincipalCreated), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Total recibido', value: Number(summary.totalPaymentsReceived), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Capital recuperado', value: Number(summary.totalCapitalRecovered), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Intereses cobrados', value: Number(summary.totalInterestCollected), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Mora cobrada', value: Number(summary.totalPenaltiesCollected), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Créditos vencidos', value: summary.overdueCredits },
  { indicator: 'Pérdidas/Riesgo', value: Number(summary.lossesAtRisk), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Ganancias', value: Number(summary.gains), __formats: { value: { numFmt: MONEY_FORMAT } } },
  { indicator: 'Caja disponible', value: Number(summary.availableCash), __formats: { value: { numFmt: MONEY_FORMAT } } },
];

const createGetCreditHistoryAuditReport = ({ reportRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor);
  const normalizedFilters = normalizeCreditHistoryFilters(filters);
  const dataset = await reportRepository.listCreditHistoryDataset(normalizedFilters);
  const report = buildCreditHistoryAuditReport({ ...dataset, filters: normalizedFilters });

  return {
    success: true,
    data: report,
  };
};

const createExportCreditHistoryAuditExcel = ({ reportRepository }) => async ({ actor, filters = {} }) => {
  const response = await createGetCreditHistoryAuditReport({ reportRepository })({ actor, filters });
  const report = response.data;

  return {
    fileName: `historial-creditos-${toDateOnlyOrNull(report.filters.startDate) || 'inicio'}-${toDateOnlyOrNull(report.filters.endDate) || 'hoy'}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: [
      {
        name: 'Resumen Auditoría',
        title: 'HISTORIAL DE CRÉDITOS',
        tabColor: STYLE_COLORS.teal,
        headerFill: STYLE_COLORS.teal,
        columns: SUMMARY_COLUMNS,
        rows: buildSummaryRows(report.summary),
      },
      {
        name: 'Historial Mensual',
        title: 'HISTORIAL MENSUAL',
        tabColor: STYLE_COLORS.blue,
        headerFill: STYLE_COLORS.blue,
        columns: MONTHLY_HISTORY_COLUMNS,
        rows: report.months,
      },
      {
        name: 'Detalle Créditos',
        title: 'CRÉDITOS CREADOS',
        tabColor: STYLE_COLORS.green,
        headerFill: STYLE_COLORS.green,
        columns: CREDIT_DETAIL_COLUMNS,
        rows: report.credits,
      },
      {
        name: 'Detalle Pagos',
        title: 'CUOTAS RECIBIDAS',
        tabColor: STYLE_COLORS.purple,
        headerFill: STYLE_COLORS.purple,
        columns: PAYMENT_DETAIL_COLUMNS,
        rows: report.payments,
      },
    ],
  };
};

const createExportCreditHistoryAuditPdf = ({ reportRepository }) => async ({ actor, filters = {} }) => {
  const response = await createGetCreditHistoryAuditReport({ reportRepository })({ actor, filters });
  const report = response.data;
  const range = [
    toDateOnlyOrNull(report.filters.startDate) || 'inicio',
    toDateOnlyOrNull(report.filters.endDate) || 'hoy',
  ].join(' a ');

  return {
    fileName: `historial-creditos-${toDateOnlyOrNull(report.filters.startDate) || 'inicio'}-${toDateOnlyOrNull(report.filters.endDate) || 'hoy'}.pdf`,
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: 'Historial de créditos',
      lines: [
        `Periodo: ${range}`,
        `Créditos creados: ${report.summary.creditsCreated}`,
        `Cuotas recibidas: ${report.summary.installmentsReceived}`,
        `Capital prestado: ${formatMoney(report.summary.totalPrincipalCreated)}`,
        `Total recibido: ${formatMoney(report.summary.totalPaymentsReceived)}`,
        `Capital recuperado: ${formatMoney(report.summary.totalCapitalRecovered)}`,
        `Intereses cobrados: ${formatMoney(report.summary.totalInterestCollected)}`,
        `Mora cobrada: ${formatMoney(report.summary.totalPenaltiesCollected)}`,
        `Créditos vencidos: ${report.summary.overdueCredits}`,
        `Pérdidas/Riesgo: ${formatMoney(report.summary.lossesAtRisk)}`,
        `Ganancias: ${formatMoney(report.summary.gains)}`,
        `Caja disponible: ${formatMoney(report.summary.availableCash)}`,
      ],
    }),
  };
};

module.exports = {
  buildCreditHistoryAuditReport,
  normalizeCreditHistoryFilters,
  createGetCreditHistoryAuditReport,
  createExportCreditHistoryAuditExcel,
  createExportCreditHistoryAuditPdf,
};
