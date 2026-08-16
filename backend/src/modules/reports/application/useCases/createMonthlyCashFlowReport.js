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
const DISBURSED_STATUSES = new Set(['pending', 'approved', 'active', 'overdue', 'paid', 'closed', 'defaulted']);
const LOSS_RISK_STATUSES = new Set(['overdue', 'defaulted']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const moneyColumn = (header, key, width = 20) => ({ header, key, width, numFmt: MONEY_FORMAT });

const CASH_FLOW_COLUMNS = [
  { header: 'Mes', key: 'month', width: 14 },
  moneyColumn('Entradas por Cuotas', 'inflows'),
  moneyColumn('Aportes de Socios', 'associateContributions', 20),
  moneyColumn('Salidas por Préstamos', 'outflows'),
  moneyColumn('Pagos a Socios', 'associatePayments', 20),
  moneyColumn('Devoluciones de Capital', 'capitalReturns', 24),
  moneyColumn('Gastos Operativos', 'operatingExpenses', 22),
  moneyColumn('Flujo Neto', 'netCashFlow'),
  moneyColumn('Caja Disponible', 'availableCash'),
  moneyColumn('Cartera por Cobrar', 'portfolioReceivable'),
  moneyColumn('Capital Recuperado', 'principalRecovered'),
  moneyColumn('Interés Cobrado', 'interestCollected'),
  moneyColumn('Mora Cobrada', 'penaltyCollected'),
  moneyColumn('Interés y Mora Cobrados', 'collectedProfit'),
  moneyColumn('Capital en Riesgo del Período', 'lossesAtRisk'),
  { header: 'Pagos Recibidos', key: 'paymentCount', width: 16 },
  { header: 'Préstamos Entregados', key: 'loanCount', width: 20 },
];

const SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'label', width: 32 },
  moneyColumn('Valor', 'value', 22),
  { header: 'Descripción', key: 'description', width: 54 },
];

const MOVEMENT_COLUMNS = [
  { header: 'Fecha', key: 'date', width: 14 },
  { header: 'Movimiento', key: 'movementLabel', width: 24 },
  { header: 'Corresponde a', key: 'counterpartyName', width: 30 },
  { header: 'Referencia', key: 'reference', width: 28 },
  moneyColumn('Entrada', 'inflow'),
  moneyColumn('Salida', 'outflow'),
];

const MOVEMENT_LABELS = Object.freeze({
  customer_payment: 'Pago de cliente',
  loan_disbursement: 'Préstamo entregado',
  associate_contribution: 'Aporte de socio',
  associate_payment: 'Pago a socio',
  associate_capital_return: 'Devolución de capital',
  associate_reinvestment: 'Reinversión de socio',
  operating_expense: 'Gasto operativo',
});

const CUSTOMER_PAYMENT_PURPOSE_LABELS = Object.freeze({
  installment: 'Pago de cuota',
  partial: 'Pago parcial',
  capital: 'Abono a capital',
  payoff: 'Pago total',
});

const normalizeCustomerPaymentType = (value) => {
  const normalized = String(value || 'installment').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(CUSTOMER_PAYMENT_PURPOSE_LABELS, normalized)
    ? normalized
    : null;
};

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

const toPlainRecord = (value) => (
  typeof value?.toJSON === 'function' ? value.toJSON() : value || {}
);

const toDateOnly = (value) => {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

const getRelatedRecord = (row, keys) => {
  const source = toPlainRecord(row);
  for (const key of keys) {
    const related = source?.[key];
    if (related) return toPlainRecord(related);
  }
  return null;
};

const buildMovement = ({
  id,
  date,
  movementType,
  counterpartyType,
  counterpartyId,
  counterpartyName,
  reference,
  inflow = 0,
  outflow = 0,
  operatorName = null,
  paymentType = null,
  movementLabel = null,
}) => ({
  id: `${movementType}-${id}`,
  date: toDateOnly(date),
  movementType,
  movementLabel: movementLabel || MOVEMENT_LABELS[movementType],
  counterpartyType,
  counterpartyId: counterpartyId ?? null,
  counterpartyName,
  reference,
  inflow: formatMoney(inflow),
  outflow: formatMoney(outflow),
  operatorName,
  paymentType,
});

const buildAccountingMovements = ({
  loans,
  payments,
  associateContributions,
  associateReinvestments,
  associatePayments,
  associateCapitalReturns,
  operatingExpenses,
}) => {
  const movements = [];

  loans
    .filter((loan) => DISBURSED_STATUSES.has(loan?.status))
    .forEach((loan) => {
      const source = toPlainRecord(loan);
      const customer = getRelatedRecord(source, ['Customer', 'customer']);
      movements.push(buildMovement({
        id: source.id,
        date: pickLoanDisbursementDate(source),
        movementType: 'loan_disbursement',
        counterpartyType: 'customer',
        counterpartyId: customer?.id ?? source.customerId,
        counterpartyName: customer?.name || `Cliente del crédito #${source.id}`,
        reference: `Crédito #${source.id}`,
        outflow: source.amount,
      }));
    });

  payments
    .filter((payment) => payment?.status === 'completed')
    .forEach((payment) => {
      const source = toPlainRecord(payment);
      const loan = getRelatedRecord(source, ['Loan', 'loan']);
      const customer = getRelatedRecord(loan, ['Customer', 'customer']);
      const loanId = source.loanId ?? loan?.id;
      const paymentType = normalizeCustomerPaymentType(source.paymentType);
      const paymentPurpose = paymentType
        ? CUSTOMER_PAYMENT_PURPOSE_LABELS[paymentType]
        : 'Pago registrado';
      movements.push(buildMovement({
        id: source.id,
        date: source.paymentDate || source.createdAt,
        movementType: 'customer_payment',
        counterpartyType: 'customer',
        counterpartyId: customer?.id ?? loan?.customerId,
        counterpartyName: customer?.name || `Cliente del crédito #${loanId}`,
        reference: `Crédito #${loanId} · ${paymentPurpose} #${source.id}`,
        inflow: source.amount,
        paymentType,
        movementLabel: paymentPurpose,
      }));
    });

  associateContributions.forEach((contribution) => {
    const source = toPlainRecord(contribution);
    const associate = getRelatedRecord(source, ['Associate', 'associate']);
    movements.push(buildMovement({
      id: source.id,
      date: source.contributionDate || source.createdAt,
      movementType: 'associate_contribution',
      counterpartyType: 'associate',
      counterpartyId: source.associateId,
      counterpartyName: associate?.name || `Socio #${source.associateId}`,
      reference: `Aporte #${source.id}`,
      inflow: source.amount,
    }));
  });

  associateReinvestments.forEach((reinvestment) => {
    const source = toPlainRecord(reinvestment);
    const associate = getRelatedRecord(source, ['Associate', 'associate']);
    movements.push(buildMovement({
      id: source.id,
      date: source.distributionDate || source.createdAt,
      movementType: 'associate_reinvestment',
      counterpartyType: 'associate',
      counterpartyId: source.associateId,
      counterpartyName: associate?.name || `Socio #${source.associateId}`,
      reference: `Reinversión #${source.id}`,
      outflow: source.amount,
    }));
  });

  associatePayments.forEach((payment) => {
    const source = toPlainRecord(payment);
    const associate = getRelatedRecord(source, ['Associate', 'associate']);
    movements.push(buildMovement({
      id: source.id,
      date: source.paidAt || source.distributionDate || source.paymentDate || source.createdAt,
      movementType: 'associate_payment',
      counterpartyType: 'associate',
      counterpartyId: source.associateId,
      counterpartyName: associate?.name || `Socio #${source.associateId}`,
      reference: `Pago a socio #${source.id}`,
      outflow: source.amount,
    }));
  });

  associateCapitalReturns.forEach((capitalReturn) => {
    const source = toPlainRecord(capitalReturn);
    const associate = getRelatedRecord(source, ['Associate', 'associate']);
    movements.push(buildMovement({
      id: source.id,
      date: source.distributionDate || source.createdAt,
      movementType: 'associate_capital_return',
      counterpartyType: 'associate',
      counterpartyId: source.associateId,
      counterpartyName: associate?.name || `Socio #${source.associateId}`,
      reference: `Devolución #${source.id}`,
      outflow: source.amount,
    }));
  });

  operatingExpenses
    .filter((expense) => ['completed', 'paid', 'posted'].includes(String(expense?.status || '').toLowerCase()))
    .forEach((expense) => {
      const source = toPlainRecord(expense);
      const operator = getRelatedRecord(source, ['createdBy', 'CreatedBy']);
      movements.push(buildMovement({
        id: source.id,
        date: source.expenseDate || source.paymentDate || source.date || source.createdAt,
        movementType: 'operating_expense',
        counterpartyType: 'expense',
        counterpartyId: null,
        counterpartyName: source.description || source.category || `Gasto #${source.id}`,
        reference: `Gasto #${source.id}${source.category ? ` · ${source.category}` : ''}`,
        outflow: source.amount,
        operatorName: operator?.name || null,
      }));
    });

  return movements.sort((left, right) => (
    left.date.localeCompare(right.date) || left.id.localeCompare(right.id)
  ));
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
  associateContributionsRaw: 0,
  capitalReturnsRaw: 0,
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
  associateContributions: formatMoney(Math.max(0, row.associateContributionsRaw)),
  outflows: formatMoney(row.outflowsRaw),
  associatePayments: formatMoney(row.associatePaymentsRaw),
  capitalReturns: formatMoney(row.capitalReturnsRaw),
  operatingExpenses: formatMoney(row.operatingExpensesRaw),
  netCashFlow: formatMoney(row.inflowsRaw + Math.max(0, row.associateContributionsRaw) - row.outflowsRaw - row.associatePaymentsRaw - row.capitalReturnsRaw - row.operatingExpensesRaw),
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
 * @param {Array<object>} input.associateContributions Canonical capital contribution rows.
 * @param {Array<object>} input.associateReinvestments Reinvestments paired with contributions and excluded from cash inflows.
 * @param {Array<object>} input.associatePayments Canonical profitability payment cash outflow rows.
 * @param {Array<object>} input.associateCapitalReturns Canonical capital return cash outflow rows.
 * @param {Array<object>} input.operatingExpenses Canonical completed operating expense rows.
 * @param {Array<object>|undefined} input.riskLoans Current overdue/defaulted loans for the current exposure snapshot.
 * @returns {{year:number, summary:object, months:Array<object>}}
 */
const buildMonthlyCashFlowReport = ({ year, loans = [], payments = [], associateContributions = [], associateReinvestments = [], associatePayments = [], associateCapitalReturns = [], operatingExpenses = [], riskLoans }) => {
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

  associateContributions.forEach((contribution) => {
    const key = monthKeyFromDate(contribution.contributionDate || contribution.createdAt);
    if (monthsByKey[key]) monthsByKey[key].associateContributionsRaw += toNumber(contribution.amount);
  });

  associateReinvestments.forEach((reinvestment) => {
    const key = monthKeyFromDate(reinvestment.distributionDate || reinvestment.createdAt);
    if (monthsByKey[key]) monthsByKey[key].associateContributionsRaw -= toNumber(reinvestment.amount);
  });

  associateCapitalReturns.forEach((capitalReturn) => {
    const key = monthKeyFromDate(capitalReturn.distributionDate || capitalReturn.createdAt);
    if (monthsByKey[key]) monthsByKey[key].capitalReturnsRaw += toNumber(capitalReturn.amount);
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
    availableCashRaw += row.inflowsRaw + Math.max(0, row.associateContributionsRaw) - row.outflowsRaw - row.associatePaymentsRaw - row.capitalReturnsRaw - row.operatingExpensesRaw;
    return formatMonth(row, availableCashRaw);
  });

  const totalInflows = rawMonths.reduce((sum, row) => sum + row.inflowsRaw, 0);
  const totalOutflows = rawMonths.reduce((sum, row) => sum + row.outflowsRaw, 0);
  const totalAssociatePayments = rawMonths.reduce((sum, row) => sum + row.associatePaymentsRaw, 0);
  const totalAssociateContributions = rawMonths.reduce((sum, row) => sum + Math.max(0, row.associateContributionsRaw), 0);
  const totalCapitalReturns = rawMonths.reduce((sum, row) => sum + row.capitalReturnsRaw, 0);
  const totalOperatingExpenses = rawMonths.reduce((sum, row) => sum + row.operatingExpensesRaw, 0);
  const totalPrincipalRecovered = rawMonths.reduce((sum, row) => sum + row.principalRecoveredRaw, 0);
  const portfolioReceivable = rawMonths.reduce((sum, row) => sum + row.portfolioReceivableRaw, 0);
  const totalInterestCollected = rawMonths.reduce((sum, row) => sum + row.interestCollectedRaw, 0);
  const totalPenaltyCollected = rawMonths.reduce((sum, row) => sum + row.penaltyCollectedRaw, 0);
  const totalCollectedProfit = totalInterestCollected + totalPenaltyCollected;
  const lossesAtRisk = rawMonths.reduce((sum, row) => sum + row.lossesAtRiskRaw, 0);
  const riskSnapshot = Array.isArray(riskLoans) ? riskLoans : loans;
  const currentCapitalAtRisk = riskSnapshot
    .filter((loan) => LOSS_RISK_STATUSES.has(loan?.status))
    .reduce((sum, loan) => sum + resolveLoanOutstanding(loan), 0);
  const netCashFlow = totalInflows + totalAssociateContributions - totalOutflows - totalAssociatePayments - totalCapitalReturns - totalOperatingExpenses;
  const operatingResult = totalCollectedProfit - totalOperatingExpenses;

  return {
    year: numericYear,
    summary: {
      totalInflows: formatMoney(totalInflows),
      totalAssociateContributions: formatMoney(totalAssociateContributions),
      totalOutflows: formatMoney(totalOutflows),
      totalAssociatePayments: formatMoney(totalAssociatePayments),
      totalCapitalReturns: formatMoney(totalCapitalReturns),
      totalOperatingExpenses: formatMoney(totalOperatingExpenses),
      netCashFlow: formatMoney(netCashFlow),
      availableCash: formatMoney(netCashFlow),
      portfolioReceivable: formatMoney(portfolioReceivable),
      totalPrincipalRecovered: formatMoney(totalPrincipalRecovered),
      totalInterestCollected: formatMoney(totalInterestCollected),
      totalPenaltyCollected: formatMoney(totalPenaltyCollected),
      totalCollectedProfit: formatMoney(totalCollectedProfit),
      lossesAtRisk: formatMoney(lossesAtRisk),
      currentCapitalAtRisk: formatMoney(currentCapitalAtRisk),
      operatingResult: formatMoney(operatingResult),
      // Keep the historical key as a compatibility alias. Investor payouts,
      // capital returns, and risk exposure belong to cash/balance-sheet views;
      // they must not reduce the credit operating result a consumer displays as profit.
      netProfitIndicator: formatMoney(operatingResult),
      paymentCount: rawMonths.reduce((sum, row) => sum + row.paymentCount, 0),
      loanCount: rawMonths.reduce((sum, row) => sum + row.loanCount, 0),
    },
    months,
    movements: buildAccountingMovements({
      loans,
      payments,
      associateContributions,
      associateReinvestments,
      associatePayments,
      associateCapitalReturns,
      operatingExpenses,
    }),
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
    { label: 'Aportes de socios', value: Number(report.summary.totalAssociateContributions), description: 'Capital nuevo recibido de socios; excluye reinversiones contables.' },
    { label: 'Salidas por préstamos', value: Number(report.summary.totalOutflows), description: 'Capital entregado en préstamos desembolsados.' },
    { label: 'Pagos a socios', value: Number(report.summary.totalAssociatePayments), description: 'Pagos registrados a socios que reducen caja disponible.' },
    { label: 'Devoluciones de capital', value: Number(report.summary.totalCapitalReturns), description: 'Capital efectivamente reintegrado a socios.' },
    { label: 'Gastos operativos', value: Number(report.summary.totalOperatingExpenses), description: 'Salidas administrativas y operativas completadas.' },
    { label: 'Caja disponible', value: Number(report.summary.availableCash), description: 'Recaudo y aportes menos préstamos, rentabilidad, devoluciones y gastos.' },
    { label: 'Cartera por cobrar', value: Number(report.summary.portfolioReceivable), description: 'Capital vigente que sigue adeudado en los créditos del período.' },
    { label: 'Capital recuperado', value: Number(report.summary.totalPrincipalRecovered), description: 'Parte de pagos que redujo capital vivo.' },
    { label: 'Interés cobrado', value: Number(report.summary.totalInterestCollected), description: 'Interés efectivamente pagado por clientes.' },
    { label: 'Mora cobrada', value: Number(report.summary.totalPenaltyCollected), description: 'Mora o penalidades efectivamente cobradas.' },
    { label: 'Interés y mora cobrados', value: Number(report.summary.totalCollectedProfit), description: 'Interés cobrado más mora cobrada.' },
    { label: 'Capital en riesgo actual', value: Number(report.summary.currentCapitalAtRisk), description: 'Capital pendiente actualmente en créditos vencidos o default; el repositorio no conserva snapshots históricos de cartera.' },
    { label: 'Resultado operativo de créditos', value: Number(report.summary.operatingResult), description: 'Interés y mora cobrados menos gastos operativos. Los pagos a socios y el capital en riesgo se presentan por separado.' },
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
        associateContributions: Number(month.associateContributions),
        outflows: Number(month.outflows),
        associatePayments: Number(month.associatePayments),
        capitalReturns: Number(month.capitalReturns),
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
    {
      name: 'Movimientos Detallados',
      title: `MOVIMIENTOS CONTABLES DETALLADOS ${report.year}`,
      tabColor: STYLE_COLORS.green,
      headerFill: STYLE_COLORS.headerBlue,
      columns: MOVEMENT_COLUMNS,
      rows: report.movements.map((movement) => ({
        ...movement,
        inflow: Number(movement.inflow),
        outflow: Number(movement.outflow),
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

const isMonthWithinDateRange = (month, { fromDate, toDate }) => {
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonthStart = new Date(monthStart.getTime());
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const monthEnd = new Date(nextMonthStart.getTime() - 1);

  if (fromDate && monthEnd < fromDate) return false;
  if (toDate && monthStart > toDate) return false;
  return true;
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
    associateContributions: dataset.associateContributions || [],
    associateReinvestments: dataset.associateReinvestments || [],
    associateCapitalReturns: dataset.associateCapitalReturns || [],
    operatingExpenses: dataset.operatingExpenses || [],
    riskLoans: dataset.riskLoans,
  });
  report.months = report.months.filter((month) => isMonthWithinDateRange(month.month, dateRange));
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
      layout: 'landscape',
      title: `Cierre contable ${report.year}`,
      subtitle: 'Cuadre mensual de recaudo, aportes, préstamos, pagos, devoluciones, gastos y caja disponible.',
      summary: [
        { label: 'Entradas por cuotas', value: formatDisplayMoney(report.summary.totalInflows) },
        { label: 'Aportes de socios', value: formatDisplayMoney(report.summary.totalAssociateContributions) },
        { label: 'Salidas por préstamos', value: formatDisplayMoney(report.summary.totalOutflows) },
        { label: 'Pagos a socios', value: formatDisplayMoney(report.summary.totalAssociatePayments) },
        { label: 'Devoluciones de capital', value: formatDisplayMoney(report.summary.totalCapitalReturns) },
        { label: 'Gastos del negocio', value: formatDisplayMoney(report.summary.totalOperatingExpenses) },
        { label: 'Interés y mora cobrados', value: formatDisplayMoney(report.summary.totalCollectedProfit) },
        { label: 'Capital en riesgo actual', value: formatDisplayMoney(report.summary.currentCapitalAtRisk) },
        { label: 'Resultado operativo de créditos', value: formatDisplayMoney(report.summary.operatingResult) },
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
            { header: 'Aportes', key: 'contributions', align: 'right' },
            { header: 'Salidas', key: 'outflows', align: 'right' },
            { header: 'Socios', key: 'associatePayments', align: 'right' },
            { header: 'Dev. capital', key: 'capitalReturns', align: 'right' },
            { header: 'Gastos', key: 'operatingExpenses', align: 'right' },
            { header: 'Resultado', key: 'net', align: 'right' },
            { header: 'Caja', key: 'cash', align: 'right', bold: true },
          ],
          rows: report.months.map((month) => ({
            month: month.month,
            inflows: formatDisplayMoney(month.inflows),
            contributions: formatDisplayMoney(month.associateContributions),
            outflows: formatDisplayMoney(month.outflows),
            associatePayments: formatDisplayMoney(month.associatePayments),
            capitalReturns: formatDisplayMoney(month.capitalReturns),
            operatingExpenses: formatDisplayMoney(month.operatingExpenses),
            net: formatDisplayMoney(month.netCashFlow),
            cash: formatDisplayMoney(month.availableCash),
          })),
        },
        tableOptions: { fontSize: 6 },
      }, {
        heading: 'Detalle por persona y movimiento',
        table: {
          columns: [
            { header: 'Fecha', key: 'date', width: 58 },
            { header: 'Movimiento', key: 'movementLabel', width: 100 },
            { header: 'Corresponde a', key: 'counterpartyName', width: 120 },
            { header: 'Referencia', key: 'reference', width: 110 },
            { header: 'Entrada', key: 'inflow', align: 'right' },
            { header: 'Salida', key: 'outflow', align: 'right' },
          ],
          rows: report.movements.map((movement) => ({
            ...movement,
            inflow: formatDisplayMoney(movement.inflow),
            outflow: formatDisplayMoney(movement.outflow),
          })),
        },
        tableOptions: { fontSize: 6 },
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
