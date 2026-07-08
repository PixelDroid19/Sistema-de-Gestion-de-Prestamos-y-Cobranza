const { buildReportPdf } = require('@/modules/shared/pdfReport');
const {
  ensureAdmin,
  formatMoney,
  formatDisplayMoney,
  parseDateRange,
} = require('@/modules/reports/application/reportHelpers');
const { toDateOnlyOrNull } = require('@/modules/shared/dateUtils');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const { MONEY_FORMAT } = require('@/modules/reports/application/excelExportFormats');

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const DISBURSED_STATUSES = new Set(['approved', 'active', 'overdue', 'paid', 'closed', 'defaulted']);
const LOSS_RISK_STATUSES = new Set(['overdue', 'defaulted']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const moneyColumn = (header, key, width = 20) => ({ header, key, width, numFmt: MONEY_FORMAT });

const CASH_FLOW_COLUMNS = [
  { header: 'Mes', key: 'month', width: 14 },
  moneyColumn('Entradas por Cuotas', 'inflows'),
  moneyColumn('Salidas por Préstamos', 'outflows'),
  moneyColumn('Salidas Financieras', 'associatePayments', 20),
  moneyColumn('Gastos Operativos', 'operatingExpenses', 22),
  moneyColumn('Flujo Neto', 'netCashFlow'),
  moneyColumn('Caja Disponible', 'availableCash'),
  moneyColumn('Cartera por Cobrar', 'portfolioReceivable'),
  moneyColumn('Capital Recuperado', 'principalRecovered'),
  moneyColumn('Interés Cobrado', 'interestCollected'),
  moneyColumn('Mora Cobrada', 'penaltyCollected'),
  moneyColumn('Interés y Mora Cobrados', 'collectedProfit'),
  moneyColumn('Pérdidas en Riesgo', 'lossesAtRisk'),
  { header: 'Pagos Recibidos', key: 'paymentCount', width: 16 },
  { header: 'Préstamos Entregados', key: 'loanCount', width: 20 },
];

const SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'label', width: 32 },
  moneyColumn('Valor', 'value', 22),
  { header: 'Descripción', key: 'description', width: 54 },
];

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const monthKeyFromDate = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const pickLoanDisbursementDate = (loan) => (
  loan?.disbursedAt
  || loan?.disbursementDate
  || loan?.approvedAt
  || loan?.startDate
  || loan?.createdAt
);

const resolveLoanOutstanding = (loan) => {
  const snapshot = loan?.financialSnapshot || {};
  return toNumber(
    loan?.principalOutstanding
    ?? snapshot.outstandingPrincipal
    ?? snapshot.principalOutstanding
    ?? snapshot.outstandingBalance
    ?? loan?.amount,
  );
};

const createEmptyMonth = (month) => ({
  month,
  inflowsRaw: 0,
  outflowsRaw: 0,
  principalRecoveredRaw: 0,
  interestCollectedRaw: 0,
  penaltyCollectedRaw: 0,
  associatePaymentsRaw: 0,
  operatingExpensesRaw: 0,
  portfolioReceivableRaw: 0,
  collectedProfitRaw: 0,
  lossesAtRiskRaw: 0,
  paymentCount: 0,
  loanCount: 0,
});

const formatMonth = (row, availableCash) => ({
  month: row.month,
  inflows: formatMoney(row.inflowsRaw),
  outflows: formatMoney(row.outflowsRaw),
  associatePayments: formatMoney(row.associatePaymentsRaw),
  operatingExpenses: formatMoney(row.operatingExpensesRaw),
  netCashFlow: formatMoney(row.inflowsRaw - row.outflowsRaw - row.associatePaymentsRaw - row.operatingExpensesRaw),
  availableCash: formatMoney(availableCash),
  portfolioReceivable: formatMoney(row.portfolioReceivableRaw),
  principalRecovered: formatMoney(row.principalRecoveredRaw),
  interestCollected: formatMoney(row.interestCollectedRaw),
  penaltyCollected: formatMoney(row.penaltyCollectedRaw),
  collectedProfit: formatMoney(row.collectedProfitRaw),
  lossesAtRisk: formatMoney(row.lossesAtRiskRaw),
  paymentCount: row.paymentCount,
  loanCount: row.loanCount,
});

/**
 * Builds a monthly cash-flow report from canonical loan and payment records.
 * Inflows are completed payment amounts; outflows are real loan capital placed.
 *
 * @param {object} input
 * @param {number} input.year Calendar year to report.
 * @param {Array<object>} input.loans Canonical loan rows.
 * @param {Array<object>} input.payments Canonical payment rows.
 * @param {Array<object>} input.associatePayments Canonical paid associate cash outflow rows.
 * @param {Array<object>} input.operatingExpenses Canonical completed operating expense rows.
 * @returns {{year:number, summary:object, months:Array<object>}}
 */
const buildMonthlyCashFlowReport = ({ year, loans = [], payments = [], associatePayments = [], operatingExpenses = [] }) => {
  const numericYear = Number.isFinite(Number(year)) ? Number(year) : new Date().getFullYear();
  const monthsByKey = MONTHS.reduce((acc, month) => {
    const monthKey = `${numericYear}-${month}`;
    acc[monthKey] = createEmptyMonth(monthKey);
    return acc;
  }, {});

  payments
    .filter((payment) => payment?.status === 'completed')
    .forEach((payment) => {
      const key = monthKeyFromDate(payment.paymentDate || payment.createdAt);
      if (!monthsByKey[key]) return;

      monthsByKey[key].inflowsRaw += toNumber(payment.amount);
      monthsByKey[key].principalRecoveredRaw += toNumber(payment.principalApplied);
      monthsByKey[key].interestCollectedRaw += toNumber(payment.interestApplied);
      monthsByKey[key].penaltyCollectedRaw += toNumber(payment.penaltyApplied);
      monthsByKey[key].collectedProfitRaw += toNumber(payment.interestApplied) + toNumber(payment.penaltyApplied);
      monthsByKey[key].paymentCount += 1;
    });

  associatePayments
    .forEach((payment) => {
      const key = monthKeyFromDate(payment.paidAt || payment.distributionDate || payment.paymentDate || payment.createdAt);
      if (!monthsByKey[key]) return;

      monthsByKey[key].associatePaymentsRaw += toNumber(payment.amount);
    });

  operatingExpenses
    .filter((expense) => ['completed', 'paid', 'posted'].includes(String(expense?.status || '').toLowerCase()))
    .forEach((expense) => {
      const key = monthKeyFromDate(expense.expenseDate || expense.paymentDate || expense.date || expense.createdAt);
      if (!monthsByKey[key]) return;

      monthsByKey[key].operatingExpensesRaw += toNumber(expense.amount);
    });

  loans
    .filter((loan) => DISBURSED_STATUSES.has(loan?.status))
    .forEach((loan) => {
      const key = monthKeyFromDate(pickLoanDisbursementDate(loan));
      if (!monthsByKey[key]) return;

      monthsByKey[key].outflowsRaw += toNumber(loan.amount);
      monthsByKey[key].portfolioReceivableRaw += resolveLoanOutstanding(loan);
      monthsByKey[key].loanCount += 1;

      if (LOSS_RISK_STATUSES.has(loan?.status)) {
        monthsByKey[key].lossesAtRiskRaw += resolveLoanOutstanding(loan);
      }
    });

  let availableCashRaw = 0;
  const rawMonths = Object.values(monthsByKey);
  const months = rawMonths.map((row) => {
    availableCashRaw += row.inflowsRaw - row.outflowsRaw - row.associatePaymentsRaw - row.operatingExpensesRaw;
    return formatMonth(row, availableCashRaw);
  });

  const totalInflows = rawMonths.reduce((sum, row) => sum + row.inflowsRaw, 0);
  const totalOutflows = rawMonths.reduce((sum, row) => sum + row.outflowsRaw, 0);
  const totalAssociatePayments = rawMonths.reduce((sum, row) => sum + row.associatePaymentsRaw, 0);
  const totalOperatingExpenses = rawMonths.reduce((sum, row) => sum + row.operatingExpensesRaw, 0);
  const totalPrincipalRecovered = rawMonths.reduce((sum, row) => sum + row.principalRecoveredRaw, 0);
  const portfolioReceivable = rawMonths.reduce((sum, row) => sum + row.portfolioReceivableRaw, 0);
  const totalInterestCollected = rawMonths.reduce((sum, row) => sum + row.interestCollectedRaw, 0);
  const totalPenaltyCollected = rawMonths.reduce((sum, row) => sum + row.penaltyCollectedRaw, 0);
  const totalCollectedProfit = totalInterestCollected + totalPenaltyCollected;
  const lossesAtRisk = rawMonths.reduce((sum, row) => sum + row.lossesAtRiskRaw, 0);

  return {
    year: numericYear,
    summary: {
      totalInflows: formatMoney(totalInflows),
      totalOutflows: formatMoney(totalOutflows),
      totalAssociatePayments: formatMoney(totalAssociatePayments),
      totalOperatingExpenses: formatMoney(totalOperatingExpenses),
      availableCash: formatMoney(totalInflows - totalOutflows - totalAssociatePayments - totalOperatingExpenses),
      portfolioReceivable: formatMoney(portfolioReceivable),
      totalPrincipalRecovered: formatMoney(totalPrincipalRecovered),
      totalInterestCollected: formatMoney(totalInterestCollected),
      totalPenaltyCollected: formatMoney(totalPenaltyCollected),
      totalCollectedProfit: formatMoney(totalCollectedProfit),
      lossesAtRisk: formatMoney(lossesAtRisk),
      netProfitIndicator: formatMoney(totalCollectedProfit - totalAssociatePayments - totalOperatingExpenses - lossesAtRisk),
      paymentCount: rawMonths.reduce((sum, row) => sum + row.paymentCount, 0),
      loanCount: rawMonths.reduce((sum, row) => sum + row.loanCount, 0),
    },
    months,
  };
};

/**
 * Builds a daily cash-flow report from the same canonical movement records as
 * the monthly report. Daily rows are grouped by UTC operational date.
 *
 * @param {object} input
 * @param {Date} input.fromDate Inclusive start date.
 * @param {Date} input.toDate Inclusive end date.
 * @param {Array<object>} input.loans Canonical loan rows.
 * @param {Array<object>} input.payments Canonical payment rows.
 * @param {Array<object>} input.associatePayments Canonical paid associate cash outflow rows.
 * @param {Array<object>} input.operatingExpenses Canonical completed operating expense rows.
 * @returns {{summary:object, days:Array<object>}}
 */
const buildCashFlowSheets = (report) => {
  const summaryRows = [
    { label: 'Entradas por cuotas', value: Number(report.summary.totalInflows), description: 'Dinero real recibido por pagos completados.' },
    { label: 'Salidas por préstamos', value: Number(report.summary.totalOutflows), description: 'Capital entregado en préstamos desembolsados.' },
    { label: 'Salidas financieras', value: Number(report.summary.totalAssociatePayments), description: 'Egresos financieros reales que reducen caja disponible.' },
    { label: 'Gastos operativos', value: Number(report.summary.totalOperatingExpenses), description: 'Salidas administrativas y operativas completadas.' },
    { label: 'Caja disponible', value: Number(report.summary.availableCash), description: 'Entradas menos préstamos, salidas financieras y gastos operativos.' },
    { label: 'Cartera por cobrar', value: Number(report.summary.portfolioReceivable), description: 'Capital vigente que sigue adeudado en los créditos del período.' },
    { label: 'Capital recuperado', value: Number(report.summary.totalPrincipalRecovered), description: 'Parte de pagos que redujo capital vivo.' },
    { label: 'Interés cobrado', value: Number(report.summary.totalInterestCollected), description: 'Interés efectivamente pagado por clientes.' },
    { label: 'Mora cobrada', value: Number(report.summary.totalPenaltyCollected), description: 'Mora o penalidades efectivamente cobradas.' },
    { label: 'Interés y mora cobrados', value: Number(report.summary.totalCollectedProfit), description: 'Interés cobrado más mora cobrada.' },
    { label: 'Pérdidas en riesgo', value: Number(report.summary.lossesAtRisk), description: 'Capital pendiente en créditos vencidos o default.' },
    { label: 'Resultado neto', value: Number(report.summary.netProfitIndicator), description: 'Interés y mora menos salidas financieras, gastos y pérdidas en riesgo.' },
  ];

  return [
    {
      name: 'Resumen Financiero',
      title: `CIERRE CONTABLE MENSUAL ${report.year}`,
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: SUMMARY_COLUMNS,
      rows: summaryRows,
    },
    {
      name: 'Créditos y Pagos',
      title: `CRÉDITOS Y PAGOS DEL PERÍODO ${report.year}`,
      tabColor: STYLE_COLORS.teal,
      headerFill: STYLE_COLORS.headerBlue,
      columns: CASH_FLOW_COLUMNS,
      rows: report.months.map((month) => ({
        ...month,
        inflows: Number(month.inflows),
        outflows: Number(month.outflows),
        associatePayments: Number(month.associatePayments),
        operatingExpenses: Number(month.operatingExpenses),
        netCashFlow: Number(month.netCashFlow),
        availableCash: Number(month.availableCash),
        portfolioReceivable: Number(month.portfolioReceivable),
        principalRecovered: Number(month.principalRecovered),
        interestCollected: Number(month.interestCollected),
        penaltyCollected: Number(month.penaltyCollected),
        collectedProfit: Number(month.collectedProfit),
        lossesAtRisk: Number(month.lossesAtRisk),
      })),
    },
  ];
};

const resolveYear = (year) => {
  const parsed = Number(year);
  return Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : new Date().getFullYear();
};

const endOfUtcDay = (date) => {
  if (!date) return null;
  const endDate = new Date(date.getTime());
  endDate.setUTCHours(23, 59, 59, 999);
  return endDate;
};

const resolveCashFlowDateRange = (filters = {}) => {
  const dateRange = parseDateRange(filters);
  const rawToDate = String(filters?.toDate || '').trim();
  return {
    ...dateRange,
    toDate: dateRange.toDate && DATE_ONLY_PATTERN.test(rawToDate)
      ? endOfUtcDay(dateRange.toDate)
      : dateRange.toDate,
  };
};

const createGetMonthlyCashFlow = ({ reportRepository }) => async ({ actor, year, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder al cierre contable mensual.');
  const resolvedYear = resolveYear(year);
  const dateRange = resolveCashFlowDateRange(filters);
  const dataset = await reportRepository.listCashFlowDataset({
    year: resolvedYear,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
  });
  const report = buildMonthlyCashFlowReport({
    year: resolvedYear,
    loans: dataset.loans || [],
    payments: dataset.payments || [],
    associatePayments: dataset.associatePayments || [],
    operatingExpenses: dataset.operatingExpenses || [],
  });
  report.filters = {
    fromDate: toDateOnlyOrNull(dateRange.fromDate),
    toDate: toDateOnlyOrNull(dateRange.toDate),
  };

  return { success: true, data: report };
};

const createExportMonthlyCashFlowExcel = ({ reportRepository }) => async ({ actor, year, filters }) => {
  const response = await createGetMonthlyCashFlow({ reportRepository })({ actor, year, filters });
  const report = response.data;
  return {
    fileName: `cierre-contable-mensual-${report.year}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: buildCashFlowSheets(report),
  };
};

const createExportMonthlyCashFlowPdf = ({ reportRepository }) => async ({ actor, year, filters }) => {
  const response = await createGetMonthlyCashFlow({ reportRepository })({ actor, year, filters });
  const report = response.data;

  return {
    fileName: `cierre-contable-mensual-${report.year}.pdf`,
    contentType: 'application/pdf',
    buffer: await buildReportPdf({
      title: `Cierre contable ${report.year}`,
      subtitle: 'Cuadre mensual de recaudo, salidas, caja disponible y cartera.',
      summary: [
        { label: 'Entradas por cuotas', value: formatDisplayMoney(report.summary.totalInflows) },
        { label: 'Salidas por préstamos', value: formatDisplayMoney(report.summary.totalOutflows) },
        { label: 'Pagos a socios', value: formatDisplayMoney(report.summary.totalAssociatePayments) },
        { label: 'Gastos del negocio', value: formatDisplayMoney(report.summary.totalOperatingExpenses) },
        { label: 'Interés y mora cobrados', value: formatDisplayMoney(report.summary.totalCollectedProfit) },
        { label: 'Capital recuperado', value: formatDisplayMoney(report.summary.totalPrincipalRecovered) },
        { label: 'Caja disponible', value: formatDisplayMoney(report.summary.availableCash) },
        { label: 'Cartera por cobrar', value: formatDisplayMoney(report.summary.portfolioReceivable) },
      ],
      sections: [{
        heading: 'Cierre mes a mes',
        table: {
          columns: [
            { header: 'Mes', key: 'month', width: 60 },
            { header: 'Entradas', key: 'inflows', align: 'right' },
            { header: 'Salidas', key: 'outflows', align: 'right' },
            { header: 'Resultado', key: 'net', align: 'right' },
            { header: 'Caja', key: 'cash', align: 'right', bold: true },
            { header: 'Cartera', key: 'portfolio', align: 'right' },
          ],
          rows: report.months.map((month) => ({
            month: month.month,
            inflows: formatDisplayMoney(month.inflows),
            outflows: formatDisplayMoney(month.outflows),
            net: formatDisplayMoney(month.netCashFlow),
            cash: formatDisplayMoney(month.availableCash),
            portfolio: formatDisplayMoney(month.portfolioReceivable),
          })),
        },
      }],
    }),
  };
};

module.exports = {
  buildMonthlyCashFlowReport,
  createGetMonthlyCashFlow,
  createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf,
  buildCashFlowSheets,
};
