const {
  assertDateRangeOrder,
  ensureAdmin,
  formatMoney,
} = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus, formatPaymentMethod, formatPaymentType } = require('@/modules/reports/application/reportLabels');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const {
  MONEY_FORMAT,
  PERCENT_FORMAT,
  DATE_FORMAT,
  DATE_TIME_FORMAT,
  INTEGER_FORMAT,
  TNA_FORMAT,
  summaryRow,
  creditInfoRow,
  roundMoney,
  toExcelDate,
} = require('@/modules/reports/application/excelExportFormats');
const { normalizeOptionalOperationalDate, toOperationalDateOrNull } = require('@/modules/shared/dateUtils');
const { deriveLoanOverdueSnapshot } = require('@/modules/credits/application/useCases');

const toPlainLoan = (loan) => (typeof loan?.toJSON === 'function' ? loan.toJSON() : loan);

/**
 * Live overdue flag for an exported credit row, derived from the canonical schedule so the
 * Excel export classifies "mora" the same way as the credits list and calendar.
 * @param {object} loan
 * @param {Array<object>} schedule - canonical schedule from loanViewService.
 * @returns {boolean}
 */
const isLoanScheduleOverdue = (loan, schedule) => (
  String(loan?.recoveryStatus || '').trim().toLowerCase() !== 'recovered'
  && deriveLoanOverdueSnapshot({ ...loan, emiSchedule: schedule }).isOverdue
);

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const parseDateOrNull = (value) => {
  return normalizeOptionalOperationalDate(value, 'date');
};

const pickLoanDate = (loan) => (
  loan?.startDate
  || loan?.approvedAt
  || loan?.disbursedAt
  || loan?.createdAt
);

const normalizeStatusFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const list = Array.isArray(value)
    ? value
    : String(value).split(',');

  const normalized = list
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : null;
};

const normalizeCreditExportFilters = (filters = {}) => {
  const normalizedFilters = {
    customerId: toNumberOrNull(filters.customerId),
    loanId: toNumberOrNull(filters.loanId ?? filters.creditId),
    startDate: parseDateOrNull(filters.startDate ?? filters.fromDate),
    endDate: parseDateOrNull(filters.endDate ?? filters.toDate),
    status: normalizeStatusFilter(filters.status),
  };
  assertDateRangeOrder(
    { fromDate: normalizedFilters.startDate, toDate: normalizedFilters.endDate },
    { fromLabel: 'startDate', toLabel: 'endDate' },
  );
  return normalizedFilters;
};

const matchesFilters = (loan, filters) => {
  if (filters.customerId !== null && Number(loan?.customerId) !== filters.customerId) {
    return false;
  }

  if (filters.loanId !== null && Number(loan?.id) !== filters.loanId) {
    return false;
  }

  if (filters.status) {
    const loanStatus = String(loan?.status || '').trim().toLowerCase();
    const recoveryStatus = String(loan?.recoveryStatus || '').trim().toLowerCase();
    // A live-overdue loan must match an "overdue/late" status filter even when its persisted
    // status was never moved to defaulted/overdue, mirroring the credits list behaviour.
    const matchesOverdueFilter = filters.status.some((value) => LATE_CREDIT_STATUSES.has(value))
      && recoveryStatus !== 'recovered'
      && deriveLoanOverdueSnapshot(loan).isOverdue;
    if (!filters.status.includes(loanStatus)
      && !filters.status.includes(recoveryStatus)
      && !matchesOverdueFilter) {
      return false;
    }
  }

  const rawLoanDate = pickLoanDate(loan);
  const loanDate = rawLoanDate ? toOperationalDateOrNull(rawLoanDate) : null;
  if ((filters.startDate || filters.endDate) && !loanDate) {
    return false;
  }

  if (filters.startDate && loanDate < filters.startDate) {
    return false;
  }

  if (filters.endDate) {
    const inclusiveEnd = new Date(filters.endDate);
    inclusiveEnd.setHours(23, 59, 59, 999);
    if (loanDate > inclusiveEnd) {
      return false;
    }
  }

  return true;
};

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: MONEY_FORMAT });
const percentColumn = (header, key, width = 15) => ({ header, key, width, numFmt: PERCENT_FORMAT });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: DATE_FORMAT });

const DETAIL_COLUMNS = [
  { header: 'ID Cliente', key: 'customerId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 30 },
  { header: 'Documento', key: 'customerDocument', width: 15 },
  { header: 'Teléfono', key: 'customerPhone', width: 15 },
  { header: 'Estado Cliente', key: 'customerState', width: 15 },
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Estado Crédito', key: 'creditStatus', width: 15 },
  moneyColumn('Monto Préstamo', 'loanAmount'),
  moneyColumn('Total con Interés', 'totalAmount'),
  moneyColumn('Saldo Pendiente', 'remainingAmount'),
  moneyColumn('Total a Cobrar', 'totalBalance'),
  { header: 'TNA (%)', key: 'tna', width: 10, numFmt: TNA_FORMAT },
  { header: 'Años', key: 'years', width: 8, numFmt: '0.00' },
  moneyColumn('Cuota', 'quota', 15),
  { header: 'Total Cuotas', key: 'totalQuotas', width: 12, numFmt: INTEGER_FORMAT },
  moneyColumn('Total Pagado', 'totalPaid'),
  moneyColumn('Capital Pagado', 'totalCapitalPaid'),
  moneyColumn('Interés Pagado', 'totalInterestPaid'),
  moneyColumn('Interés Proyectado', 'totalInterestGenerated'),
  moneyColumn('Mora Pagada', 'totalLatePaymentInterest'),
  { header: 'Núm. Pagos', key: 'paymentCount', width: 12, numFmt: INTEGER_FORMAT },
  percentColumn('% Pagado', 'percentagePaid'),
  percentColumn('% Capital Pagado', 'percentageCapitalPaid', 16),
  percentColumn('% Interés Pagado', 'percentageInterestPaid', 16),
  dateColumn('Fecha Préstamo', 'loanDate'),
  dateColumn('Próximo Pago', 'nextPaymentDate'),
  dateColumn('Último Pago', 'lastPaymentDate'),
  moneyColumn('Interés y mora/Millón', 'profitPerMillion'),
];

const SUMMARY_COLUMNS = [
  { header: 'Sección', key: 'section', width: 35 },
  { header: 'Indicador', key: 'indicator', width: 35 },
  { header: 'Valor', key: 'value', width: 22 },
];

const AMORTIZATION_COLUMNS = [
  { header: 'Número de Cuota', key: 'installmentNumber', width: 18, numFmt: INTEGER_FORMAT },
  moneyColumn('CUOTA A PAGAR', 'scheduledPayment'),
  moneyColumn('INTERÉS', 'interestComponent'),
  moneyColumn('CAPITAL AMORTIZADO', 'principalComponent', 22),
  moneyColumn('CAPITAL VIVO', 'remainingBalance'),
];

const PAYMENT_COLUMNS = [
  dateColumn('Fecha de Pago', 'paymentDate', 18),
  moneyColumn('Monto', 'amount'),
  { header: 'Tipo Pago', key: 'paymentType', width: 16 },
  { header: 'Cuota #', key: 'installmentNumber', width: 10, numFmt: INTEGER_FORMAT },
  { header: 'Método', key: 'paymentMethod', width: 18 },
];

const roundPercent = (value) => Math.round(Number(value || 0) * 10000) / 10000;

const toDateValue = (value) => toExcelDate(value);

const getLoanCustomer = (loan) => loan?.Customer || loan?.customer || {};

const pickCustomerDocument = (customer = {}) => (
  customer.document
  || customer.documentNumber
  || customer.identification
  || customer.idNumber
  || 'Sin documento registrado'
);

const pickCustomerState = (customer = {}) => (
  customer.state
  || customer.status
  || 'Sin estado'
);

const getPaymentMethod = (payment = {}) => (
  formatPaymentMethod(payment.paymentMethod)
);

const compactRepeatedSections = (rows = []) => {
  let lastSection = null;

  return rows.map((row) => {
    if (!row.section || row.section !== lastSection) {
      lastSection = row.section;
      return row;
    }

    return {
      ...row,
      section: '',
    };
  });
};

const normalizeRowStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'n/a' ? '' : normalized;
};

const LATE_CREDIT_STATUSES = new Set(['late', 'defaulted', 'overdue']);

const isLateCredit = (row) => (
  LATE_CREDIT_STATUSES.has(normalizeRowStatus(row.status))
  || LATE_CREDIT_STATUSES.has(normalizeRowStatus(row.recoveryStatus))
  || Boolean(row.isOverdue)
);

const buildSummaryRows = (rows) => {
  const totalCustomers = new Set(rows.map((row) => row.customerId).filter(Boolean)).size;
  const totalCredits = rows.length;
  const activeCredits = rows.filter((row) => !['closed', 'completed', 'paid', 'end'].includes(normalizeRowStatus(row.status))).length;
  const completedCredits = totalCredits - activeCredits;
  const lateCredits = rows.filter(isLateCredit).length;
  const sum = (key) => roundMoney(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
  const totalLoanAmount = sum('loanAmount');
  const totalAmountWithInterest = sum('totalAmount');
  const totalPaid = sum('totalPaid');
  const totalCapitalPaid = sum('totalCapitalPaid');
  const totalInterestPaid = sum('totalInterestPaid');
  const totalInterestGenerated = sum('totalInterestGenerated');
  const totalLatePaymentInterest = sum('totalLatePaymentInterest');
  const totalRemainingAmount = sum('remainingAmount');
  const totalRemainingWithInterest = sum('totalBalance');
  const totalInterestPending = roundMoney(Math.max(totalInterestGenerated - totalInterestPaid, 0));
  const averageTNA = rows.length > 0
    ? roundMoney(rows.reduce((total, row) => total + Number(row.tna || 0), 0) / rows.length)
    : 0;
  const averageProfitPerMillion = rows.length > 0
    ? roundMoney(rows.reduce((total, row) => total + Number(row.profitPerMillion || 0), 0) / rows.length)
    : 0;

  return compactRepeatedSections([
    summaryRow('INFORMACIÓN GENERAL', 'Fecha de Generación', new Date(), DATE_TIME_FORMAT),
    summaryRow('INFORMACIÓN GENERAL', 'Total de Clientes', totalCustomers, INTEGER_FORMAT),
    summaryRow('INFORMACIÓN GENERAL', 'Total de Créditos', totalCredits, INTEGER_FORMAT),
    summaryRow('INFORMACIÓN GENERAL', 'Créditos Activos', activeCredits, INTEGER_FORMAT),
    summaryRow('INFORMACIÓN GENERAL', 'Créditos Finalizados', completedCredits, INTEGER_FORMAT),
    summaryRow('INFORMACIÓN GENERAL', 'Créditos en Mora', lateCredits, INTEGER_FORMAT),
    summaryRow('MONTOS TOTALES (SIN INTERESES)', 'Total Prestado (Capital)', totalLoanAmount, MONEY_FORMAT),
    summaryRow('MONTOS TOTALES (SIN INTERESES)', 'Capital Pendiente', totalRemainingAmount, MONEY_FORMAT),
    summaryRow('MONTOS TOTALES (CON INTERESES)', 'Total a Cobrar', totalAmountWithInterest, MONEY_FORMAT),
    summaryRow('MONTOS TOTALES (CON INTERESES)', 'Saldo con Intereses', totalRemainingWithInterest, MONEY_FORMAT),
    summaryRow('PAGOS TOTALES', 'Total Pagado', totalPaid, MONEY_FORMAT),
    summaryRow('PAGOS TOTALES', 'Capital Pagado', totalCapitalPaid, MONEY_FORMAT),
    summaryRow('PAGOS TOTALES', 'Interés Pagado', totalInterestPaid, MONEY_FORMAT),
    summaryRow('PAGOS TOTALES', 'Intereses por Mora', totalLatePaymentInterest, MONEY_FORMAT),
    summaryRow('INTERESES PROYECTADOS', 'Interés Total Proyectado', totalInterestGenerated, MONEY_FORMAT),
    summaryRow('INTERESES PROYECTADOS', 'Interés Pendiente', totalInterestPending, MONEY_FORMAT),
    summaryRow('MÉTRICAS FINANCIERAS', 'TNA Promedio', averageTNA / 100, PERCENT_FORMAT),
    summaryRow('MÉTRICAS FINANCIERAS', 'Interés y mora promedio por millón', averageProfitPerMillion, MONEY_FORMAT),
    summaryRow('MÉTRICAS FINANCIERAS', 'Tasa de Recaudo', totalAmountWithInterest > 0 ? totalPaid / totalAmountWithInterest : 0, PERCENT_FORMAT),
    summaryRow('PORCENTAJES GLOBALES', '% Total Pagado', totalAmountWithInterest > 0 ? totalPaid / totalAmountWithInterest : 0, PERCENT_FORMAT),
    summaryRow('PORCENTAJES GLOBALES', '% Capital Recuperado', totalLoanAmount > 0 ? totalCapitalPaid / totalLoanAmount : 0, PERCENT_FORMAT),
    summaryRow('PORCENTAJES GLOBALES', '% Intereses Cobrados', totalInterestGenerated > 0 ? totalInterestPaid / totalInterestGenerated : 0, PERCENT_FORMAT),
  ]);
};

const buildCreditSections = ({ loan, detailRow, payments, schedule }) => {
  const creditInfo = [
    creditInfoRow('Cliente', detailRow.customerName),
    creditInfoRow('Documento', detailRow.customerDocument),
    creditInfoRow('Teléfono', detailRow.customerPhone),
    creditInfoRow('Estado Cliente', detailRow.customerState),
    creditInfoRow('Estado Crédito', detailRow.creditStatus),
    creditInfoRow('Monto Préstamo', detailRow.loanAmount, MONEY_FORMAT),
    creditInfoRow('Tasa del crédito', Number(detailRow.tna || 0) / 100, PERCENT_FORMAT),
    creditInfoRow('Total con Intereses', detailRow.totalAmount, MONEY_FORMAT),
    creditInfoRow('Saldo Pendiente', detailRow.remainingAmount, MONEY_FORMAT),
    creditInfoRow('Total Pagado', detailRow.totalPaid, MONEY_FORMAT),
    creditInfoRow('Capital Pagado', detailRow.totalCapitalPaid, MONEY_FORMAT),
    creditInfoRow('Interés Pagado', detailRow.totalInterestPaid, MONEY_FORMAT),
    creditInfoRow('Interés Proyectado', detailRow.totalInterestGenerated, MONEY_FORMAT),
    creditInfoRow('Mora Pagada', detailRow.totalLatePaymentInterest, MONEY_FORMAT),
    creditInfoRow('% Total Pagado', detailRow.percentagePaid || 0, PERCENT_FORMAT),
    creditInfoRow('% Capital Recuperado', detailRow.percentageCapitalPaid || 0, PERCENT_FORMAT),
    creditInfoRow('% Interés Cobrado', detailRow.percentageInterestPaid || 0, PERCENT_FORMAT),
  ];

  const amortizationRows = [
    {
      installmentNumber: 0,
      scheduledPayment: '',
      interestComponent: '',
      principalComponent: '',
      remainingBalance: roundMoney(loan.amount),
    },
    ...schedule.map((row) => ({
      installmentNumber: row.installmentNumber,
      scheduledPayment: roundMoney(row.scheduledPayment),
      interestComponent: roundMoney(row.interestComponent),
      principalComponent: roundMoney(row.principalComponent),
      remainingBalance: roundMoney(row.remainingBalance),
    })),
  ];

  const paymentRows = payments.map((payment) => ({
    paymentDate: toDateValue(payment.paymentDate || payment.paidAt || payment.createdAt),
    amount: roundMoney(payment.amount),
    paymentType: formatPaymentType(payment.paymentType || 'installment'),
    installmentNumber: payment.installmentNumber || payment.paymentMetadata?.installmentNumber || '',
    paymentMethod: getPaymentMethod(payment),
  }));

  return [
    {
      title: `CRÉDITO #${detailRow.creditId} - ${detailRow.customerName}`,
      titleFill: STYLE_COLORS.yellow,
      headerFill: STYLE_COLORS.lightGray,
      columns: [{ header: 'Campo', key: 'campo', width: 24 }, { header: 'Valor', key: 'valor', width: 34 }],
      rows: creditInfo,
    },
    {
      title: 'TABLA DE AMORTIZACIÓN',
      titleFill: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.blue,
      columns: AMORTIZATION_COLUMNS,
      rows: amortizationRows,
    },
    {
      title: 'HISTORIAL DE PAGOS',
      titleFill: STYLE_COLORS.green,
      headerFill: STYLE_COLORS.lightGray,
      columns: PAYMENT_COLUMNS,
      rows: paymentRows,
    },
  ];
};

/**
 * Export credits using the same operator-facing workbook structure as the previous system.
 *
 * The report intentionally excludes technical calculation fields from visible sheets.
 * Those values remain available in snapshots and audit records, but this Excel is for
 * portfolio review, payments, amortization and recovery analysis.
 *
 * @param {object} dependencies
 * @param {object} dependencies.reportRepository Repository with loan report reads.
 * @param {object} dependencies.paymentRepository Repository with payment reads by loan.
 * @param {object} dependencies.loanViewService Canonical loan schedule/snapshot service.
 * @returns {Function} Express use-case handler.
 */
const buildCreditsExportDataset = async ({ reportRepository, paymentRepository, loanViewService, filters }) => {
  const normalizedFilters = normalizeCreditExportFilters(filters);
  const listLoans = typeof reportRepository.listCreditLoans === 'function'
    ? reportRepository.listCreditLoans.bind(reportRepository)
    : reportRepository.listOutstandingLoans.bind(reportRepository);
  const loans = (await listLoans())
    .map(toPlainLoan)
    .filter((loan) => matchesFilters(loan, normalizedFilters));

  return { normalizedFilters, loans };
};

const createExportCreditsExcel = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden exportar datos de créditos.');

  const { loans } = await buildCreditsExportDataset({
    reportRepository,
    paymentRepository,
    loanViewService,
    filters,
  });

  const creditSheets = [];
  const rows = await Promise.all(
    loans.map(async (loan) => {
      const payments = await paymentRepository.listByLoan(loan.id);
      const { schedule, snapshot } = loanViewService.getCanonicalLoanView(loan);
      const customer = getLoanCustomer(loan);

      const completedPayments = payments.filter((payment) => payment.status === 'completed');
      const totalPaid = completedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const totalPrincipal = completedPayments.reduce((sum, payment) => sum + Number(payment.principalApplied || 0), 0);
      const totalInterest = completedPayments.reduce((sum, payment) => sum + Number(payment.interestApplied || 0), 0);
      const totalPenalty = completedPayments.reduce((sum, payment) => sum + Number(payment.penaltyApplied || 0), 0);
      const totalInterestGenerated = Number(snapshot.totalInterest || 0);
      const totalPayable = Number(snapshot.totalPayable || 0);
      const termMonths = Number(loan.termMonths || schedule.length || 0);
      const percentagePaid = totalPayable > 0 ? totalPaid / totalPayable : 0;
      const percentageCapitalPaid = Number(loan.amount || 0) > 0 ? totalPrincipal / Number(loan.amount || 0) : 0;
      const percentageInterestPaid = totalInterestGenerated > 0 ? totalInterest / totalInterestGenerated : 0;
      const profitPerMillion = Number(loan.amount || 0) > 0
        ? (totalInterestGenerated / Number(loan.amount || 1)) * 1000000
        : 0;
      const lastPayment = [...completedPayments].sort((left, right) => (
        (toOperationalDateOrNull(right.paymentDate || right.createdAt)?.getTime() || 0)
        - (toOperationalDateOrNull(left.paymentDate || left.createdAt)?.getTime() || 0)
      ))[0];

      const detailRow = {
        creditId: loan.id,
        loanId: loan.id,
        customerId: loan.customerId,
        customerName: customer?.name || 'Cliente no disponible',
        customerDocument: pickCustomerDocument(customer),
        customerPhone: customer?.phone || 'Sin teléfono registrado',
        customerState: pickCustomerState(customer),
        loanAmount: roundMoney(loan.amount),
        amount: formatMoney(loan.amount),
        totalAmount: roundMoney(totalPayable),
        remainingAmount: roundMoney(snapshot.outstandingPrincipal),
        totalBalance: roundMoney(snapshot.outstandingBalance),
        tna: Number(loan.interestRate || 0),
        years: termMonths > 0 ? roundMoney(termMonths / 12) : 0,
        quota: roundMoney(snapshot.installmentAmount),
        totalQuotas: schedule.length,
        status: loan.status || '',
        creditStatus: formatOperationalStatus(loan.status),
        recoveryStatus: loan.recoveryStatus || '',
        isOverdue: isLoanScheduleOverdue(loan, schedule),
        totalPaid: roundMoney(totalPaid),
        totalCapitalPaid: roundMoney(totalPrincipal),
        totalInterestPaid: roundMoney(totalInterest),
        totalInterestGenerated: roundMoney(totalInterestGenerated),
        totalLatePaymentInterest: roundMoney(totalPenalty),
        paymentCount: completedPayments.length,
        percentagePaid: roundPercent(percentagePaid),
        percentageCapitalPaid: roundPercent(percentageCapitalPaid),
        percentageInterestPaid: roundPercent(percentageInterestPaid),
        loanDate: toDateValue(pickLoanDate(loan)),
        nextPaymentDate: toDateValue(snapshot.nextInstallment?.dueDate),
        lastPaymentDate: toDateValue(lastPayment?.paymentDate || lastPayment?.createdAt),
        profitPerMillion: roundMoney(profitPerMillion),
      };

      creditSheets.push({
        name: `Crédito ${loan.id}`,
        tabColor: STYLE_COLORS.yellow,
        sections: buildCreditSections({ loan, detailRow, payments, schedule }),
      });

      return detailRow;
    }),
  );

  const sheets = [
    {
      name: 'Resumen General',
      title: 'REPORTE DE CRÉDITOS - RESUMEN GENERAL',
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: SUMMARY_COLUMNS,
      rows: buildSummaryRows(rows),
      autoFilter: false,
    },
    {
      name: 'Detalle de Créditos',
      title: 'DETALLE DE CRÉDITOS',
      tabColor: STYLE_COLORS.green,
      headerFill: STYLE_COLORS.green,
      columns: DETAIL_COLUMNS,
      rows,
      autoFilter: true,
    },
    ...creditSheets,
  ];

  return {
    success: true,
    data: { rows, sheets },
  };
};

module.exports = {
  createExportCreditsExcel,
  normalizeCreditExportFilters,
  matchesFilters,
};
