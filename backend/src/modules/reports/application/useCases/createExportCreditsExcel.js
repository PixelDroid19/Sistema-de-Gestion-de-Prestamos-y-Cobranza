const {
  assertDateRangeOrder,
  ensureAdmin,
  formatMoney,
  buildPdfBuffer,
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

const toPlainLoan = (loan) => (typeof loan?.toJSON === 'function' ? loan.toJSON() : loan);

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
    if (!filters.status.includes(loanStatus) && !filters.status.includes(recoveryStatus)) {
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
  moneyColumn('Interés Generado', 'totalInterestGenerated'),
  moneyColumn('Mora Acumulada', 'totalLatePaymentInterest'),
  { header: 'Núm. Pagos', key: 'paymentCount', width: 12, numFmt: INTEGER_FORMAT },
  percentColumn('% Pagado', 'percentagePaid'),
  percentColumn('% Capital Pagado', 'percentageCapitalPaid', 16),
  percentColumn('% Interés Pagado', 'percentageInterestPaid', 16),
  dateColumn('Fecha Préstamo', 'loanDate'),
  dateColumn('Próximo Pago', 'nextPaymentDate'),
  dateColumn('Último Pago', 'lastPaymentDate'),
  moneyColumn('Ganancia/Millón', 'profitPerMillion'),
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
  || 'N/A'
);

const pickCustomerState = (customer = {}) => (
  customer.state
  || customer.status
  || 'N/A'
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

const buildSummaryRows = (rows) => {
  const totalCustomers = new Set(rows.map((row) => row.customerId).filter(Boolean)).size;
  const totalCredits = rows.length;
  const activeCredits = rows.filter((row) => !['closed', 'completed', 'paid', 'end'].includes(String(row.creditStatus || '').toLowerCase())).length;
  const completedCredits = totalCredits - activeCredits;
  const lateCredits = rows.filter((row) => ['late', 'defaulted', 'overdue'].includes(String(row.recoveryStatus || row.creditStatus || '').toLowerCase())).length;
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
    summaryRow('INTERESES PROYECTADOS', 'Interés Total Generado', totalInterestGenerated, MONEY_FORMAT),
    summaryRow('INTERESES PROYECTADOS', 'Interés Pendiente', totalInterestPending, MONEY_FORMAT),
    summaryRow('MÉTRICAS FINANCIERAS', 'TNA Promedio', averageTNA / 100, PERCENT_FORMAT),
    summaryRow('MÉTRICAS FINANCIERAS', 'Ganancia Promedio por Millón', averageProfitPerMillion, MONEY_FORMAT),
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
    creditInfoRow('Interés Generado', detailRow.totalInterestGenerated, MONEY_FORMAT),
    creditInfoRow('Mora Acumulada', detailRow.totalLatePaymentInterest, MONEY_FORMAT),
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
        customerName: customer?.name || 'N/A',
        customerDocument: pickCustomerDocument(customer),
        customerPhone: customer?.phone || 'N/A',
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
        status: loan.status || 'N/A',
        creditStatus: formatOperationalStatus(loan.status),
        recoveryStatus: loan.recoveryStatus || 'N/A',
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

const buildCreditsRowsForExport = async ({ loans, paymentRepository, loanViewService }) => Promise.all(
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

    return {
      creditId: loan.id,
      customerId: loan.customerId,
      customerName: customer?.name || 'N/A',
      customerDocument: pickCustomerDocument(customer),
      loanAmount: roundMoney(loan.amount),
      totalAmount: roundMoney(totalPayable),
      remainingAmount: roundMoney(snapshot.outstandingPrincipal),
      remainingBalance: roundMoney(snapshot.outstandingBalance),
      tna: Number(loan.interestRate || 0),
      termMonths,
      totalQuotas: schedule.length,
      status: loan.status || 'N/A',
      recoveryStatus: loan.recoveryStatus || 'N/A',
      totalPaid: roundMoney(totalPaid),
      totalCapitalPaid: roundMoney(totalPrincipal),
      totalInterestPaid: roundMoney(totalInterest),
      totalInterestGenerated: roundMoney(totalInterestGenerated),
      totalLatePaymentInterest: roundMoney(totalPenalty),
      paymentCount: completedPayments.length,
      loanDate: pickLoanDate(loan),
    };
  }),
);

const sumColumn = (rows, key) => roundMoney(rows.reduce((total, row) => total + Number(row[key] || 0), 0));

const countByStatus = (rows, predicates) => predicates.reduce((acc, [label, predicate]) => {
  acc[label] = rows.filter(predicate).length;
  return acc;
}, {});

const buildPdfSummaryLines = (rows) => {
  const totalCustomers = new Set(rows.map((row) => row.customerId).filter(Boolean)).size;
  const counts = countByStatus(rows, [
    ['Activos', (row) => !['closed', 'completed', 'paid'].includes(String(row.status || '').toLowerCase())],
    ['Cerrados', (row) => ['closed', 'completed', 'paid'].includes(String(row.status || '').toLowerCase())],
    ['Vencidos', (row) => ['defaulted', 'overdue', 'late'].includes(String(row.status || row.recoveryStatus || '').toLowerCase())],
  ]);
  const totalLoanAmount = sumColumn(rows, 'loanAmount');
  const totalPaid = sumColumn(rows, 'totalPaid');
  const totalCapitalPaid = sumColumn(rows, 'totalCapitalPaid');
  const totalInterestPaid = sumColumn(rows, 'totalInterestPaid');
  const totalInterestGenerated = sumColumn(rows, 'totalInterestGenerated');
  const totalRemaining = sumColumn(rows, 'remainingAmount');
  const totalLate = sumColumn(rows, 'totalLatePaymentInterest');
  const availableCash = roundMoney(totalPaid - totalLoanAmount);
  const profit = roundMoney(totalInterestPaid + totalLate);

  return [
    `Generado: ${new Date().toISOString()}`,
    `Total clientes: ${totalCustomers}`,
    `Total créditos: ${rows.length}`,
    `Créditos activos: ${counts.Activos}`,
    `Créditos cerrados: ${counts.Cerrados}`,
    `Créditos vencidos: ${counts.Vencidos}`,
    `Total prestado (capital): ${formatMoney(totalLoanAmount)}`,
    `Cuotas recibidas (total cobrado): ${formatMoney(totalPaid)}`,
    `Capital recuperado: ${formatMoney(totalCapitalPaid)}`,
    `Intereses cobrados: ${formatMoney(totalInterestPaid)}`,
    `Intereses generados: ${formatMoney(totalInterestGenerated)}`,
    `Mora cobrada: ${formatMoney(totalLate)}`,
    `Saldo pendiente: ${formatMoney(totalRemaining)}`,
    `Ganancia (intereses + mora): ${formatMoney(profit)}`,
    `Caja disponible (cobrado - prestado): ${formatMoney(availableCash)}`,
  ];
};

const createExportCreditsPdf = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden exportar datos de créditos.');
  const { loans } = await buildCreditsExportDataset({ reportRepository, paymentRepository, loanViewService, filters });
  const rows = await buildCreditsRowsForExport({ loans, paymentRepository, loanViewService });
  const buffer = buildPdfBuffer({
    title: 'Reporte de Créditos',
    lines: buildPdfSummaryLines(rows),
  });

  return {
    fileName: `reporte-creditos-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: 'application/pdf',
    buffer,
  };
};

module.exports = {
  createExportCreditsExcel,
  createExportCreditsPdf,
  normalizeCreditExportFilters,
  matchesFilters,
};
