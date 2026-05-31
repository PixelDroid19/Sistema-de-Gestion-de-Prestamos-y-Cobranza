const { ensureAdmin, formatMoney, parseDateRange } = require('@/modules/reports/application/reportHelpers');
const { toDateOnlyOrNull } = require('@/modules/shared/dateUtils');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MONEY_FORMAT = '"$"#,##0.00';
const DISBURSED_STATUSES = new Set(['approved', 'active', 'overdue', 'paid', 'closed', 'defaulted']);
const LOSS_RISK_STATUSES = new Set(['overdue', 'defaulted']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const moneyColumn = (header, key, width = 20) => ({ header, key, width, numFmt: MONEY_FORMAT });

const CASH_FLOW_COLUMNS = [
  { header: 'Mes', key: 'month', width: 14 },
  moneyColumn('Entradas por Cuotas', 'inflows'),
  moneyColumn('Salidas por Préstamos', 'outflows'),
  moneyColumn('Intereses Pagados a Socios', 'associateInterestPaid', 26),
  moneyColumn('Intereses Pendientes a Socios', 'associateInterestPending', 28),
  moneyColumn('Gastos Operativos', 'operatingExpenses', 22),
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
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const dayKeyFromDate = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
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
  associateInterestPaidRaw: 0,
  associateInterestPendingRaw: 0,
  operatingExpensesRaw: 0,
  collectedProfitRaw: 0,
  lossesAtRiskRaw: 0,
  paymentCount: 0,
  loanCount: 0,
});

const formatMonth = (row, availableCash) => ({
  month: row.month,
  inflows: formatMoney(row.inflowsRaw),
  outflows: formatMoney(row.outflowsRaw),
  associateInterestPaid: formatMoney(row.associateInterestPaidRaw),
  associateInterestPending: formatMoney(row.associateInterestPendingRaw),
  operatingExpenses: formatMoney(row.operatingExpensesRaw),
  netCashFlow: formatMoney(row.inflowsRaw - row.outflowsRaw - row.associateInterestPaidRaw - row.operatingExpensesRaw),
  availableCash: formatMoney(availableCash),
  principalRecovered: formatMoney(row.principalRecoveredRaw),
  interestCollected: formatMoney(row.interestCollectedRaw),
  penaltyCollected: formatMoney(row.penaltyCollectedRaw),
  collectedProfit: formatMoney(row.collectedProfitRaw),
  lossesAtRisk: formatMoney(row.lossesAtRiskRaw),
  paymentCount: row.paymentCount,
  loanCount: row.loanCount,
});

const createEmptyDay = (date) => ({
  date,
  inflowsRaw: 0,
  outflowsRaw: 0,
  principalRecoveredRaw: 0,
  interestCollectedRaw: 0,
  penaltyCollectedRaw: 0,
  associateInterestPaidRaw: 0,
  associateInterestPendingRaw: 0,
  operatingExpensesRaw: 0,
  collectedProfitRaw: 0,
  lossesAtRiskRaw: 0,
  paymentCount: 0,
  loanCount: 0,
});

const formatDay = (row, availableCash) => ({
  date: row.date,
  inflows: formatMoney(row.inflowsRaw),
  outflows: formatMoney(row.outflowsRaw),
  associateInterestPaid: formatMoney(row.associateInterestPaidRaw),
  associateInterestPending: formatMoney(row.associateInterestPendingRaw),
  operatingExpenses: formatMoney(row.operatingExpensesRaw),
  netCashFlow: formatMoney(row.inflowsRaw - row.outflowsRaw - row.associateInterestPaidRaw - row.operatingExpensesRaw),
  availableCash: formatMoney(availableCash),
  principalRecovered: formatMoney(row.principalRecoveredRaw),
  interestCollected: formatMoney(row.interestCollectedRaw),
  penaltyCollected: formatMoney(row.penaltyCollectedRaw),
  collectedProfit: formatMoney(row.collectedProfitRaw),
  lossesAtRisk: formatMoney(row.lossesAtRiskRaw),
  paymentCount: row.paymentCount,
  loanCount: row.loanCount,
});

const startOfUtcDay = (date) => {
  if (!date) return null;
  const startDate = new Date(date.getTime());
  startDate.setUTCHours(0, 0, 0, 0);
  return startDate;
};

const buildDayKeys = ({ fromDate, toDate }) => {
  const start = startOfUtcDay(fromDate || new Date());
  const end = startOfUtcDay(toDate || fromDate || new Date());
  const keys = [];
  const cursor = new Date(start.getTime());

  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

/**
 * Builds a monthly cash-flow report from canonical loan and payment records.
 * Inflows are completed payment amounts; outflows are real loan capital placed.
 *
 * @param {object} input
 * @param {number} input.year Calendar year to report.
 * @param {Array<object>} input.loans Canonical loan rows.
 * @param {Array<object>} input.payments Canonical payment rows.
 * @param {Array<object>} input.associateInterestPayments Paid associate interest installment rows.
 * @param {Array<object>} input.operatingExpenses Canonical completed operating expense rows.
 * @returns {{year:number, summary:object, months:Array<object>}}
 */
const buildMonthlyCashFlowReport = ({ year, loans = [], payments = [], associateInterestPayments = [], operatingExpenses = [] }) => {
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

  associateInterestPayments
    .forEach((installment) => {
      const status = String(installment?.status || '').toLowerCase();
      const isPaid = status === 'paid';
      const isPending = status === 'pending' || status === 'overdue';
      const key = monthKeyFromDate(isPaid
        ? installment.paidAt || installment.paymentDate || installment.createdAt
        : installment.dueDate || installment.createdAt);
      if (!monthsByKey[key]) return;

      if (isPaid) {
        monthsByKey[key].associateInterestPaidRaw += toNumber(installment.amount);
      } else if (isPending) {
        monthsByKey[key].associateInterestPendingRaw += toNumber(installment.amount);
      }
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
      monthsByKey[key].loanCount += 1;

      if (LOSS_RISK_STATUSES.has(loan?.status)) {
        monthsByKey[key].lossesAtRiskRaw += resolveLoanOutstanding(loan);
      }
    });

  let availableCashRaw = 0;
  const rawMonths = Object.values(monthsByKey);
  const months = rawMonths.map((row) => {
    availableCashRaw += row.inflowsRaw - row.outflowsRaw - row.associateInterestPaidRaw - row.operatingExpensesRaw;
    return formatMonth(row, availableCashRaw);
  });

  const totalInflows = rawMonths.reduce((sum, row) => sum + row.inflowsRaw, 0);
  const totalOutflows = rawMonths.reduce((sum, row) => sum + row.outflowsRaw, 0);
  const totalAssociateInterestPaid = rawMonths.reduce((sum, row) => sum + row.associateInterestPaidRaw, 0);
  const totalAssociateInterestPending = rawMonths.reduce((sum, row) => sum + row.associateInterestPendingRaw, 0);
  const totalOperatingExpenses = rawMonths.reduce((sum, row) => sum + row.operatingExpensesRaw, 0);
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
      totalAssociateInterestPaid: formatMoney(totalAssociateInterestPaid),
      totalAssociateInterestPending: formatMoney(totalAssociateInterestPending),
      totalOperatingExpenses: formatMoney(totalOperatingExpenses),
      availableCash: formatMoney(totalInflows - totalOutflows - totalAssociateInterestPaid - totalOperatingExpenses),
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

/**
 * Builds a daily cash-flow report from the same canonical movement records as
 * the monthly report. Daily rows are grouped by UTC operational date.
 *
 * @param {object} input
 * @param {Date} input.fromDate Inclusive start date.
 * @param {Date} input.toDate Inclusive end date.
 * @param {Array<object>} input.loans Canonical loan rows.
 * @param {Array<object>} input.payments Canonical payment rows.
 * @param {Array<object>} input.associateInterestPayments Paid associate interest installment rows.
 * @param {Array<object>} input.operatingExpenses Canonical completed operating expense rows.
 * @returns {{summary:object, days:Array<object>}}
 */
const buildDailyCashFlowReport = ({ fromDate, toDate, loans = [], payments = [], associateInterestPayments = [], operatingExpenses = [] }) => {
  const dayKeys = buildDayKeys({ fromDate, toDate });
  const daysByKey = dayKeys.reduce((acc, date) => {
    acc[date] = createEmptyDay(date);
    return acc;
  }, {});

  payments
    .filter((payment) => payment?.status === 'completed')
    .forEach((payment) => {
      const key = dayKeyFromDate(payment.paymentDate || payment.createdAt);
      if (!daysByKey[key]) return;

      daysByKey[key].inflowsRaw += toNumber(payment.amount);
      daysByKey[key].principalRecoveredRaw += toNumber(payment.principalApplied);
      daysByKey[key].interestCollectedRaw += toNumber(payment.interestApplied);
      daysByKey[key].penaltyCollectedRaw += toNumber(payment.penaltyApplied);
      daysByKey[key].collectedProfitRaw += toNumber(payment.interestApplied) + toNumber(payment.penaltyApplied);
      daysByKey[key].paymentCount += 1;
    });

  associateInterestPayments
    .forEach((installment) => {
      const status = String(installment?.status || '').toLowerCase();
      const isPaid = status === 'paid';
      const isPending = status === 'pending' || status === 'overdue';
      const key = dayKeyFromDate(isPaid
        ? installment.paidAt || installment.paymentDate || installment.createdAt
        : installment.dueDate || installment.createdAt);
      if (!daysByKey[key]) return;

      if (isPaid) {
        daysByKey[key].associateInterestPaidRaw += toNumber(installment.amount);
      } else if (isPending) {
        daysByKey[key].associateInterestPendingRaw += toNumber(installment.amount);
      }
    });

  operatingExpenses
    .filter((expense) => ['completed', 'paid', 'posted'].includes(String(expense?.status || '').toLowerCase()))
    .forEach((expense) => {
      const key = dayKeyFromDate(expense.expenseDate || expense.paymentDate || expense.date || expense.createdAt);
      if (!daysByKey[key]) return;

      daysByKey[key].operatingExpensesRaw += toNumber(expense.amount);
    });

  loans
    .filter((loan) => DISBURSED_STATUSES.has(loan?.status))
    .forEach((loan) => {
      const key = dayKeyFromDate(pickLoanDisbursementDate(loan));
      if (!daysByKey[key]) return;

      daysByKey[key].outflowsRaw += toNumber(loan.amount);
      daysByKey[key].loanCount += 1;

      if (LOSS_RISK_STATUSES.has(loan?.status)) {
        daysByKey[key].lossesAtRiskRaw += resolveLoanOutstanding(loan);
      }
    });

  let availableCashRaw = 0;
  const rawDays = Object.values(daysByKey);
  const days = rawDays.map((row) => {
    availableCashRaw += row.inflowsRaw - row.outflowsRaw - row.associateInterestPaidRaw - row.operatingExpensesRaw;
    return formatDay(row, availableCashRaw);
  });

  const totalInflows = rawDays.reduce((sum, row) => sum + row.inflowsRaw, 0);
  const totalOutflows = rawDays.reduce((sum, row) => sum + row.outflowsRaw, 0);
  const totalAssociateInterestPaid = rawDays.reduce((sum, row) => sum + row.associateInterestPaidRaw, 0);
  const totalAssociateInterestPending = rawDays.reduce((sum, row) => sum + row.associateInterestPendingRaw, 0);
  const totalOperatingExpenses = rawDays.reduce((sum, row) => sum + row.operatingExpensesRaw, 0);
  const totalPrincipalRecovered = rawDays.reduce((sum, row) => sum + row.principalRecoveredRaw, 0);
  const totalInterestCollected = rawDays.reduce((sum, row) => sum + row.interestCollectedRaw, 0);
  const totalPenaltyCollected = rawDays.reduce((sum, row) => sum + row.penaltyCollectedRaw, 0);
  const totalCollectedProfit = totalInterestCollected + totalPenaltyCollected;
  const lossesAtRisk = rawDays.reduce((sum, row) => sum + row.lossesAtRiskRaw, 0);

  return {
    summary: {
      totalInflows: formatMoney(totalInflows),
      totalOutflows: formatMoney(totalOutflows),
      totalAssociateInterestPaid: formatMoney(totalAssociateInterestPaid),
      totalAssociateInterestPending: formatMoney(totalAssociateInterestPending),
      totalOperatingExpenses: formatMoney(totalOperatingExpenses),
      availableCash: formatMoney(totalInflows - totalOutflows - totalAssociateInterestPaid - totalOperatingExpenses),
      totalPrincipalRecovered: formatMoney(totalPrincipalRecovered),
      totalInterestCollected: formatMoney(totalInterestCollected),
      totalPenaltyCollected: formatMoney(totalPenaltyCollected),
      totalCollectedProfit: formatMoney(totalCollectedProfit),
      lossesAtRisk: formatMoney(lossesAtRisk),
      netProfitIndicator: formatMoney(totalCollectedProfit - lossesAtRisk),
      paymentCount: rawDays.reduce((sum, row) => sum + row.paymentCount, 0),
      loanCount: rawDays.reduce((sum, row) => sum + row.loanCount, 0),
    },
    days,
  };
};

const buildCashFlowSheets = (report) => {
  const summaryRows = [
    { label: 'Entradas por cuotas', value: Number(report.summary.totalInflows), description: 'Dinero real recibido por pagos completados.' },
    { label: 'Salidas por préstamos', value: Number(report.summary.totalOutflows), description: 'Capital entregado en préstamos desembolsados.' },
    { label: 'Intereses pagados a socios', value: Number(report.summary.totalAssociateInterestPaid), description: 'Rentabilidad pagada a socios inversionistas.' },
    { label: 'Intereses pendientes de socios', value: Number(report.summary.totalAssociateInterestPending), description: 'Obligaciones programadas con socios que aún no han afectado la caja.' },
    { label: 'Gastos operativos', value: Number(report.summary.totalOperatingExpenses), description: 'Salidas administrativas y operativas completadas.' },
    { label: 'Caja disponible', value: Number(report.summary.availableCash), description: 'Entradas menos préstamos, intereses a socios y gastos operativos.' },
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
        associateInterestPaid: Number(month.associateInterestPaid),
        associateInterestPending: Number(month.associateInterestPending),
        operatingExpenses: Number(month.operatingExpenses),
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

const endOfUtcDay = (date) => {
  if (!date) return null;
  const endDate = new Date(date.getTime());
  endDate.setUTCHours(23, 59, 59, 999);
  return endDate;
};

const resolveDailyCashFlowDateRange = (filters = {}) => {
  if (filters.date) {
    const dateRange = parseDateRange({ fromDate: filters.date, toDate: filters.date });
    return {
      fromDate: startOfUtcDay(dateRange.fromDate),
      toDate: endOfUtcDay(dateRange.toDate),
    };
  }

  const dateRange = resolveCashFlowDateRange(filters);
  const today = startOfUtcDay(new Date());
  const fromDate = startOfUtcDay(dateRange.fromDate || dateRange.toDate || today);
  return {
    fromDate,
    toDate: endOfUtcDay(dateRange.toDate || fromDate),
  };
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
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder al flujo de caja mensual.');
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
    associateInterestPayments: dataset.associateInterestPayments || [],
    operatingExpenses: dataset.operatingExpenses || [],
  });
  report.filters = {
    fromDate: toDateOnlyOrNull(dateRange.fromDate),
    toDate: toDateOnlyOrNull(dateRange.toDate),
  };

  return { success: true, data: report };
};

const createGetDailyCashFlow = ({ reportRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder al flujo de caja diario.');
  const dateRange = resolveDailyCashFlowDateRange(filters);
  const year = dateRange.fromDate.getUTCFullYear();
  const dataset = await reportRepository.listCashFlowDataset({
    year,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
  });
  const report = buildDailyCashFlowReport({
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    loans: dataset.loans || [],
    payments: dataset.payments || [],
    associateInterestPayments: dataset.associateInterestPayments || [],
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
    fileName: `flujo-caja-mensual-${report.year}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: buildCashFlowSheets(report),
  };
};

const createExportMonthlyCashFlowPdf = ({ reportRepository }) => async ({ actor, year, filters }) => {
  const response = await createGetMonthlyCashFlow({ reportRepository })({ actor, year, filters });
  const report = response.data;
  const title = `Flujo de caja mensual ${report.year}`;
  const lines = [
    `Entradas por cuotas: $${report.summary.totalInflows}`,
    `Salidas por préstamos: $${report.summary.totalOutflows}`,
    `Intereses pagados a socios: $${report.summary.totalAssociateInterestPaid}`,
    `Intereses pendientes de socios: $${report.summary.totalAssociateInterestPending}`,
    `Gastos operativos: $${report.summary.totalOperatingExpenses}`,
    `Caja disponible: $${report.summary.availableCash}`,
    `Ganancia cobrada: $${report.summary.totalCollectedProfit}`,
    `Pérdidas en riesgo: $${report.summary.lossesAtRisk}`,
    `Resultado neto: $${report.summary.netProfitIndicator}`,
    '',
    'Historial mensual:',
    ...report.months.map((month) => `${month.month}: entradas $${month.inflows} - salidas $${month.outflows} - socios pagados $${month.associateInterestPaid} - socios pendientes $${month.associateInterestPending} - gastos $${month.operatingExpenses} = caja $${month.availableCash}`),
  ].slice(0, 42);

  return {
    fileName: `flujo-caja-mensual-${report.year}.pdf`,
    contentType: 'application/pdf',
    buffer: buildSimplePdfBuffer({ title, lines }),
  };
};

module.exports = {
  buildMonthlyCashFlowReport,
  buildDailyCashFlowReport,
  createGetMonthlyCashFlow,
  createGetDailyCashFlow,
  createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf,
  buildCashFlowSheets,
};
