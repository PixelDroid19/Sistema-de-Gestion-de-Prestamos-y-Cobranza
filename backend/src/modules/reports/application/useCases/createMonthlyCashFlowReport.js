const { ensureAdmin, formatMoney } = require('@/modules/reports/application/reportHelpers');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MONEY_FORMAT = '"$"#,##0.00';
const DISBURSED_STATUSES = new Set(['approved', 'active', 'overdue', 'paid', 'closed', 'defaulted']);
const LOSS_RISK_STATUSES = new Set(['overdue', 'defaulted']);

const moneyColumn = (header, key, width = 20) => ({ header, key, width, numFmt: MONEY_FORMAT });

const CASH_FLOW_COLUMNS = [
  { header: 'Mes', key: 'month', width: 14 },
  moneyColumn('Entradas por Cuotas', 'inflows'),
  moneyColumn('Salidas por Préstamos', 'outflows'),
  moneyColumn('Flujo Neto', 'netCashFlow'),
  moneyColumn('Caja Disponible', 'availableCash'),
  moneyColumn('Capital Recuperado', 'principalRecovered'),
  moneyColumn('Interés Cobrado', 'interestCollected'),
  moneyColumn('Mora Cobrada', 'penaltyCollected'),
  moneyColumn('Ganancia Cobrada', 'collectedProfit'),
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
  collectedProfitRaw: 0,
  lossesAtRiskRaw: 0,
  paymentCount: 0,
  loanCount: 0,
});

const formatMonth = (row, availableCash) => ({
  month: row.month,
  inflows: formatMoney(row.inflowsRaw),
  outflows: formatMoney(row.outflowsRaw),
  netCashFlow: formatMoney(row.inflowsRaw - row.outflowsRaw),
  availableCash: formatMoney(availableCash),
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
 * @returns {{year:number, summary:object, months:Array<object>}}
 */
const buildMonthlyCashFlowReport = ({ year, loans = [], payments = [] }) => {
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

  loans
    .filter((loan) => DISBURSED_STATUSES.has(loan?.status))
    .forEach((loan) => {
      const key = monthKeyFromDate(pickLoanDisbursementDate(loan));
      if (!monthsByKey[key]) return;

      monthsByKey[key].outflowsRaw += toNumber(loan.amount);
      monthsByKey[key].loanCount += 1;

      if (LOSS_RISK_STATUSES.has(loan?.status)) {
        monthsByKey[key].lossesAtRiskRaw += resolveLoanOutstanding(loan);
      }
    });

  let availableCashRaw = 0;
  const rawMonths = Object.values(monthsByKey);
  const months = rawMonths.map((row) => {
    availableCashRaw += row.inflowsRaw - row.outflowsRaw;
    return formatMonth(row, availableCashRaw);
  });

  const totalInflows = rawMonths.reduce((sum, row) => sum + row.inflowsRaw, 0);
  const totalOutflows = rawMonths.reduce((sum, row) => sum + row.outflowsRaw, 0);
  const totalPrincipalRecovered = rawMonths.reduce((sum, row) => sum + row.principalRecoveredRaw, 0);
  const totalInterestCollected = rawMonths.reduce((sum, row) => sum + row.interestCollectedRaw, 0);
  const totalPenaltyCollected = rawMonths.reduce((sum, row) => sum + row.penaltyCollectedRaw, 0);
  const totalCollectedProfit = totalInterestCollected + totalPenaltyCollected;
  const lossesAtRisk = rawMonths.reduce((sum, row) => sum + row.lossesAtRiskRaw, 0);

  return {
    year: numericYear,
    summary: {
      totalInflows: formatMoney(totalInflows),
      totalOutflows: formatMoney(totalOutflows),
      availableCash: formatMoney(totalInflows - totalOutflows),
      totalPrincipalRecovered: formatMoney(totalPrincipalRecovered),
      totalInterestCollected: formatMoney(totalInterestCollected),
      totalPenaltyCollected: formatMoney(totalPenaltyCollected),
      totalCollectedProfit: formatMoney(totalCollectedProfit),
      lossesAtRisk: formatMoney(lossesAtRisk),
      netProfitIndicator: formatMoney(totalCollectedProfit - lossesAtRisk),
      paymentCount: rawMonths.reduce((sum, row) => sum + row.paymentCount, 0),
      loanCount: rawMonths.reduce((sum, row) => sum + row.loanCount, 0),
    },
    months,
  };
};

const buildCashFlowSheets = (report) => {
  const summaryRows = [
    { label: 'Entradas por cuotas', value: Number(report.summary.totalInflows), description: 'Dinero real recibido por pagos completados.' },
    { label: 'Salidas por préstamos', value: Number(report.summary.totalOutflows), description: 'Capital entregado en préstamos desembolsados.' },
    { label: 'Caja disponible', value: Number(report.summary.availableCash), description: 'Entradas menos salidas acumuladas del año.' },
    { label: 'Capital recuperado', value: Number(report.summary.totalPrincipalRecovered), description: 'Parte de pagos que redujo capital vivo.' },
    { label: 'Interés cobrado', value: Number(report.summary.totalInterestCollected), description: 'Interés efectivamente pagado por clientes.' },
    { label: 'Mora cobrada', value: Number(report.summary.totalPenaltyCollected), description: 'Mora o penalidades efectivamente cobradas.' },
    { label: 'Ganancia cobrada', value: Number(report.summary.totalCollectedProfit), description: 'Interés cobrado más mora cobrada.' },
    { label: 'Pérdidas en riesgo', value: Number(report.summary.lossesAtRisk), description: 'Capital pendiente en créditos vencidos o default.' },
    { label: 'Resultado neto', value: Number(report.summary.netProfitIndicator), description: 'Ganancia cobrada menos pérdidas en riesgo.' },
  ];

  return [
    {
      name: 'Resumen Financiero',
      title: `CONTROL FINANCIERO MENSUAL ${report.year}`,
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: SUMMARY_COLUMNS,
      rows: summaryRows,
    },
    {
      name: 'Historial Mensual',
      title: `HISTORIAL MENSUAL DE FLUJO DE CAJA ${report.year}`,
      tabColor: STYLE_COLORS.teal,
      headerFill: STYLE_COLORS.headerBlue,
      columns: CASH_FLOW_COLUMNS,
      rows: report.months.map((month) => ({
        ...month,
        inflows: Number(month.inflows),
        outflows: Number(month.outflows),
        netCashFlow: Number(month.netCashFlow),
        availableCash: Number(month.availableCash),
        principalRecovered: Number(month.principalRecovered),
        interestCollected: Number(month.interestCollected),
        penaltyCollected: Number(month.penaltyCollected),
        collectedProfit: Number(month.collectedProfit),
        lossesAtRisk: Number(month.lossesAtRisk),
      })),
    },
  ];
};

const escapePdfText = (value) => String(value)
  .replaceAll('\\', '\\\\')
  .replaceAll('(', '\\(')
  .replaceAll(')', '\\)');

const buildSimplePdfBuffer = ({ title, lines }) => {
  const commands = [
    'BT',
    '/F1 16 Tf',
    '50 780 Td',
    `(${escapePdfText(title)}) Tj`,
    '0 -28 Td',
    '/F1 10 Tf',
  ];

  lines.forEach((line, index) => {
    if (index > 0) commands.push('0 -16 Td');
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push('ET');

  const stream = commands.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`,
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

const resolveYear = (year) => {
  const parsed = Number(year);
  return Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : new Date().getFullYear();
};

const createGetMonthlyCashFlow = ({ reportRepository }) => async ({ actor, year }) => {
  ensureAdmin(actor, 'Only admins can access monthly cash flow reports');
  const resolvedYear = resolveYear(year);
  const dataset = await reportRepository.listCashFlowDataset({ year: resolvedYear });
  const report = buildMonthlyCashFlowReport({
    year: resolvedYear,
    loans: dataset.loans || [],
    payments: dataset.payments || [],
  });

  return { success: true, data: report };
};

const createExportMonthlyCashFlowExcel = ({ reportRepository }) => async ({ actor, year }) => {
  const response = await createGetMonthlyCashFlow({ reportRepository })({ actor, year });
  const report = response.data;
  return {
    fileName: `flujo-caja-mensual-${report.year}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: buildCashFlowSheets(report),
  };
};

const createExportMonthlyCashFlowPdf = ({ reportRepository }) => async ({ actor, year }) => {
  const response = await createGetMonthlyCashFlow({ reportRepository })({ actor, year });
  const report = response.data;
  const title = `Flujo de caja mensual ${report.year}`;
  const lines = [
    `Entradas por cuotas: $${report.summary.totalInflows}`,
    `Salidas por préstamos: $${report.summary.totalOutflows}`,
    `Caja disponible: $${report.summary.availableCash}`,
    `Ganancia cobrada: $${report.summary.totalCollectedProfit}`,
    `Pérdidas en riesgo: $${report.summary.lossesAtRisk}`,
    `Resultado neto: $${report.summary.netProfitIndicator}`,
    '',
    'Historial mensual:',
    ...report.months.map((month) => `${month.month}: entradas $${month.inflows} - salidas $${month.outflows} = caja $${month.availableCash}`),
  ].slice(0, 42);

  return {
    fileName: `flujo-caja-mensual-${report.year}.pdf`,
    contentType: 'application/pdf',
    buffer: buildSimplePdfBuffer({ title, lines }),
  };
};

module.exports = {
  buildMonthlyCashFlowReport,
  createGetMonthlyCashFlow,
  createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf,
  buildCashFlowSheets,
};
