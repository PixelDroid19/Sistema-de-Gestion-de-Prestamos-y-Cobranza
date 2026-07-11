const { buildReportPdf } = require('@/modules/shared/pdfReport');
const { NotFoundError } = require('@/utils/errorHandler');
const { toOperationalDateOrNull } = require('@/modules/shared/dateUtils');
const {
  ensureAdmin,
  formatDisplayMoney,
  assertDateRangeOrder,
} = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus } = require('@/modules/reports/application/reportLabels');
const { buildWorkbookBuffer, STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const {
  buildCsv,
  moneyColumn,
  dateColumn,
} = require('@/modules/reports/application/reportInternals');
const {
  MONEY_FORMAT,
  PERCENT_FORMAT,
  TNA_FORMAT,
  indicatorRow,
  roundMoney,
  toExcelDate,
  formatExcelDisplayValue,
} = require('@/modules/reports/application/excelExportFormats');
const {
  normalizeAssociateRecord,
  filterCapitalBearingContributions,
} = require('./useCases');

// Reinvestments create both a ProfitDistribution and a matching AssociateContribution,
// so they must be excluded from "distributed profit" to avoid double-counting against
// the operational financial-detail read-model (which uses interestWithdrawals only).
const NON_PROFIT_DISTRIBUTION_TYPES = new Set(['capital_return', 'reinvestment']);
const isDistributedProfit = (distribution) => !NON_PROFIT_DISTRIBUTION_TYPES.has(distribution.distributionType);

const ASSOCIATE_DISTRIBUTION_TYPE_LABELS = {
  manual: 'Pago manual de rentabilidad',
  reinvestment: 'Reinversión',
  capital_return: 'Devolución de capital',
};

const normalizeAssociateDistributionTypeKey = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue === 'capital_return') {
    return 'capital_return';
  }

  if (normalizedValue === 'reinvestment') {
    return 'reinvestment';
  }

  return normalizedValue;
};

const ASSOCIATE_EXPORT_SECTIONS = {
  summary: 'Resumen',
  contribution: 'Aporte',
  distribution: 'Pago manual de rentabilidad',
  reinvestment: 'Reinversión',
  capitalReturn: 'Devolución de capital',
  interestPaid: 'Interés pagado',
  interestDue: 'Interés pendiente',
};

const SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'indicator', width: 34 },
  { header: 'Valor', key: 'value', width: 22 },
  { header: 'Descripción', key: 'description', width: 42 },
];

const DETAIL_COLUMNS = [
  { header: 'ID Socio', key: 'associateId', width: 12 },
  { header: 'Socio', key: 'associateName', width: 28 },
  { header: 'Tipo de Interés', key: 'interestType', width: 18 },
  { header: 'Tasa Pactada %', key: 'interestRate', width: 18, numFmt: TNA_FORMAT },
  moneyColumn('Deuda con Socio', 'interestDebt', 20),
  moneyColumn('Interés Pagado', 'totalInterestPaid', 20),
  dateColumn('Próximo Pago', 'nextInterestPaymentDate', 18),
  { header: 'Sección', key: 'section', width: 16 },
  { header: 'ID Movimiento', key: 'entryId', width: 16 },
  { header: 'Referencia', key: 'reference', width: 24 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha', 'date', 18),
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Rentabilidad del Aporte', key: 'contributionInterestType', width: 24 },
  { header: 'Tasa Histórica del Aporte %', key: 'contributionInterestRate', width: 28, numFmt: TNA_FORMAT },
  { header: 'Tipo de Movimiento', key: 'distributionType', width: 20 },
  { header: 'Notas', key: 'notes', width: 34 },
];

const STATUS_COLUMNS = [
  { header: 'Estado', key: 'status', width: 18 },
  { header: 'Cantidad', key: 'count', width: 14, numFmt: '#,##0' },
  moneyColumn('Monto Total', 'amount'),
  { header: 'Porcentaje', key: 'percentage', width: 14, numFmt: PERCENT_FORMAT },
];

const SECTION_COLUMNS = [
  { header: 'Sección', key: 'section', width: 18 },
  { header: 'Cantidad', key: 'count', width: 14 },
  moneyColumn('Monto Total', 'amount'),
];

const ASSOCIATE_FINANCIAL_SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'indicator', width: 34 },
  { header: 'Valor', key: 'value', width: 22 },
];

const ASSOCIATE_CONTRIBUTION_COLUMNS = [
  { header: 'ID Aporte', key: 'contributionId', width: 14 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha Aporte', 'contributionDate', 18),
  { header: 'Notas', key: 'notes', width: 34 },
];

const ASSOCIATE_DISTRIBUTION_COLUMNS = [
  { header: 'ID Movimiento', key: 'distributionId', width: 16 },
  { header: 'Referencia', key: 'creditId', width: 18 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha Movimiento', 'distributionDate', 20),
  { header: 'Tipo de Movimiento', key: 'distributionType', width: 20 },
  { header: 'Notas', key: 'notes', width: 34 },
];

const ASSOCIATE_INSTALLMENT_COLUMNS = [
  { header: 'Cuota', key: 'installmentNumber', width: 12 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha Programada', 'dueDate', 20),
  dateColumn('Fecha Real de Pago', 'paidAt', 20),
  { header: 'Estado', key: 'status', width: 16 },
  { header: 'Método de Pago', key: 'paymentMethod', width: 20 },
  { header: 'Responsable', key: 'paidBy', width: 24 },
  { header: 'Notas', key: 'notes', width: 34 },
];

const parseMoney = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;

const normalizeReportingDistributionRecord = (distribution) => {
  const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;
  const basis = serializedDistribution?.basis || {};
  const distributionType = basis.type === 'capital-return'
    ? 'capital_return'
    : (basis.type === 'reinvestment'
      ? 'reinvestment'
      : 'manual');
  return {
    ...serializedDistribution,
    distributionType,
  };
};

const normalizeAssociateFilterId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
};

const normalizeAssociateStatusFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['active', 'inactive'].includes(normalized) ? normalized : null;
};

const normalizeAssociateSearchFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
};

const associateMatchesSearch = (associate, search) => {
  if (!search) {
    return true;
  }

  return [
    associate.name,
    associate.email,
    associate.phone,
    associate.document,
    associate.documentNumber,
    associate.identification,
  ].some((value) => String(value || '').toLowerCase().includes(search));
};

const normalizeDateFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return toOperationalDateOrNull(value);
};

const buildDateRangeFilter = (filters = {}) => {
  const range = {
    fromDate: normalizeDateFilter(filters.fromDate),
    toDate: normalizeDateFilter(filters.toDate),
  };
  assertDateRangeOrder(range);
  return range;
};

const isWithinDateRange = (value, range) => {
  const date = toOperationalDateOrNull(value);
  if (!date) {
    return true;
  }

  if (range.fromDate && date < range.fromDate) {
    return false;
  }

  if (range.toDate && date > range.toDate) {
    return false;
  }

  return true;
};

const movementPairKey = (date, amount) => {
  const operationalDate = toOperationalDateOrNull(date);
  return `${operationalDate?.toISOString().slice(0, 10) || ''}:${Math.round(parseMoney(amount) * 100)}`;
};

const excludePairedReinvestmentContributions = (contributions, distributions) => {
  const reinvestmentCounts = distributions
    .filter((distribution) => distribution.distributionType === 'reinvestment')
    .reduce((counts, distribution) => {
      const key = movementPairKey(distribution.distributionDate, distribution.amount);
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());

  return contributions.filter((contribution) => {
    const key = movementPairKey(contribution.contributionDate, contribution.amount);
    const remaining = reinvestmentCounts.get(key) || 0;
    if (remaining <= 0) return true;
    reinvestmentCounts.set(key, remaining - 1);
    return false;
  });
};

const formatDistributionType = (value) => {
  if (!value) return 'No aplica';
  const typeKey = normalizeAssociateDistributionTypeKey(value);
  if (ASSOCIATE_DISTRIBUTION_TYPE_LABELS[typeKey]) {
    return ASSOCIATE_DISTRIBUTION_TYPE_LABELS[typeKey];
  }
  // Preserve operator-recorded movement labels; never surface unclassified placeholders.
  return String(value).trim();
};

const formatAssociateDistributionType = (value) => {
  if (!value) return '';
  const typeKey = normalizeAssociateDistributionTypeKey(value);
  if (ASSOCIATE_DISTRIBUTION_TYPE_LABELS[typeKey]) {
    return ASSOCIATE_DISTRIBUTION_TYPE_LABELS[typeKey];
  }
  return String(value).trim();
};

const formatInterestType = (value) => (value === 'annual' ? 'Anual' : 'Mensual');

const formatPdfMoney = (value) => formatDisplayMoney(value);

const isOverdueInterestInstallment = (installment, asOfDate = new Date()) => {
  if (installment?.status === 'overdue') {
    return true;
  }

  if (installment?.status !== 'pending') {
    return false;
  }

  const dueDate = toOperationalDateOrNull(installment.dueDate);
  return Boolean(dueDate && dueDate < asOfDate);
};

const resolveInterestInstallmentExportStatus = (installment, asOfDate = new Date()) => {
  if (installment?.status === 'paid') {
    return 'paid';
  }

  if (installment?.status === 'overdue') {
    return 'overdue';
  }

  return isOverdueInterestInstallment(installment, asOfDate) ? 'overdue' : 'pending';
};

const isUnpaidInterestInstallment = (installment) => ['pending', 'overdue'].includes(String(installment?.status || '').toLowerCase());

const buildAssociateSheets = (rows) => {
  const associateIds = new Set(rows.map((row) => row.associateId).filter(Boolean));
  const contributionRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.contribution);
  const distributionRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.distribution);
  const reinvestmentRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.reinvestment);
  const capitalReturnRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.capitalReturn);
  const interestRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestPaid || row.section === ASSOCIATE_EXPORT_SECTIONS.interestDue);
  const totalContributed = contributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalDistributed = distributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalReinvested = reinvestmentRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalCapitalReturned = capitalReturnRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestPaid = interestRows.filter((row) => row.status === 'Pagado').reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestDebt = interestRows.filter((row) => row.status !== 'Pagado').reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const movementRows = rows.filter((row) => row.section !== ASSOCIATE_EXPORT_SECTIONS.summary);
  const byStatus = Array.from(movementRows.reduce((map, row) => {
    const status = row.status || 'Sin estado';
    const current = map.get(status) || { status, count: 0, amount: 0 };
    current.count += 1;
    current.amount += parseMoney(row.amount);
    map.set(status, current);
    return map;
  }, new Map()).values()).map((row) => ({
    ...row,
    amount: roundMoney(row.amount),
    percentage: movementRows.length > 0 ? row.count / movementRows.length : 0,
  }));
  const bySection = Array.from(movementRows.reduce((map, row) => {
    const section = row.section || 'Sin sección';
    const current = map.get(section) || { section, count: 0, amount: 0 };
    current.count += 1;
    current.amount += parseMoney(row.amount);
    map.set(section, current);
    return map;
  }, new Map()).values()).map((row) => ({
    ...row,
    amount: roundMoney(row.amount),
  }));

  return [
    {
      name: 'Resumen General',
      title: 'REPORTE GENERAL DE SOCIOS',
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: SUMMARY_COLUMNS,
      rows: [
        { ...indicatorRow('Total de Socios', associateIds.size, '#,##0'), description: 'Número total de socios incluidos en el reporte' },
        { ...indicatorRow('Aportes Totales', roundMoney(totalContributed), MONEY_FORMAT), description: 'Suma de aportes registrados' },
        { ...indicatorRow('Pagos manuales de rentabilidad', roundMoney(totalDistributed), MONEY_FORMAT), description: 'Pagos de rentabilidad registrados fuera del cronograma' },
        { ...indicatorRow('Reinversiones', roundMoney(totalReinvested), MONEY_FORMAT), description: 'Rentabilidad reinvertida como nuevo capital' },
        { ...indicatorRow('Capital Devuelto', roundMoney(totalCapitalReturned), MONEY_FORMAT), description: 'Capital reintegrado al socio' },
        { ...indicatorRow('Interés Pagado', roundMoney(totalInterestPaid), MONEY_FORMAT), description: 'Intereses pagados a socios' },
        { ...indicatorRow('Deuda con Socios', roundMoney(totalInterestDebt), MONEY_FORMAT), description: 'Intereses programados pendientes de pago' },
      ],
      autoFilter: false,
    },
    {
      name: 'Movimientos por Estado',
      title: 'MOVIMIENTOS DE SOCIOS POR ESTADO',
      tabColor: STYLE_COLORS.yellow,
      headerFill: STYLE_COLORS.headerBlue,
      columns: STATUS_COLUMNS,
      rows: byStatus,
    },
    {
      name: 'Movimientos por Tipo',
      title: 'MOVIMIENTOS POR SECCIÓN',
      tabColor: STYLE_COLORS.green,
      headerFill: STYLE_COLORS.headerBlue,
      columns: SECTION_COLUMNS,
      rows: bySection,
    },
    {
      name: 'Detalle de Socios',
      title: 'DETALLE COMPLETO DE SOCIOS',
      tabColor: STYLE_COLORS.red,
      headerFill: STYLE_COLORS.headerBlue,
      columns: DETAIL_COLUMNS,
      rows,
    },
    {
      name: 'Control financiero',
      title: 'CONTROL FINANCIERO DE SOCIOS',
      tabColor: STYLE_COLORS.purple,
      headerFill: STYLE_COLORS.headerBlue,
      columns: SUMMARY_COLUMNS,
      rows: [
        { ...indicatorRow('Aportes Totales', roundMoney(totalContributed), MONEY_FORMAT), description: 'Capital aportado por socios' },
        { ...indicatorRow('Pagos manuales de rentabilidad', roundMoney(totalDistributed), MONEY_FORMAT), description: 'Rentabilidad reconocida fuera del cronograma' },
        { ...indicatorRow('Reinversiones', roundMoney(totalReinvested), MONEY_FORMAT), description: 'Rentabilidad reinvertida como nuevo capital' },
        { ...indicatorRow('Capital Devuelto', roundMoney(totalCapitalReturned), MONEY_FORMAT), description: 'Capital reintegrado a socios' },
        { ...indicatorRow('Interés Pagado', roundMoney(totalInterestPaid), MONEY_FORMAT), description: 'Pagos de intereses ejecutados' },
        { ...indicatorRow('Interés Pendiente', roundMoney(totalInterestDebt), MONEY_FORMAT), description: 'Estado de deuda con socios' },
      ],
      autoFilter: false,
    },
    {
      name: 'Resumen de movimientos',
      title: 'RESUMEN DE MOVIMIENTOS DE SOCIOS',
      tabColor: STYLE_COLORS.teal,
      headerFill: STYLE_COLORS.headerBlue,
      columns: SECTION_COLUMNS,
      rows: [
        { section: 'Aportes', count: contributionRows.length, amount: roundMoney(totalContributed) },
        { section: 'Pagos manuales de rentabilidad', count: distributionRows.length, amount: roundMoney(totalDistributed) },
        { section: 'Reinversiones', count: reinvestmentRows.length, amount: roundMoney(totalReinvested) },
        { section: 'Devoluciones de capital', count: capitalReturnRows.length, amount: roundMoney(totalCapitalReturned) },
        { section: 'Intereses pagados', count: interestRows.filter((row) => row.status === 'Pagado').length, amount: roundMoney(totalInterestPaid) },
        { section: 'Intereses pendientes', count: interestRows.filter((row) => row.status !== 'Pagado').length, amount: roundMoney(totalInterestDebt) },
      ],
    },
  ];
};

const createExportAssociatesExcel = ({ associateRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden exportar información de socios.');
  const associateIdFilter = normalizeAssociateFilterId(filters.associateId);
  const searchFilter = normalizeAssociateSearchFilter(filters.search);
  const statusFilter = normalizeAssociateStatusFilter(filters.status);
  const dateRange = buildDateRangeFilter(filters);
  const associates = associateIdFilter
    ? [await associateRepository.findById(associateIdFilter)].filter(Boolean)
    : await associateRepository.list();
  const selectedAssociates = associates.filter((associate) => (
    associateMatchesSearch(associate, searchFilter)
    && (!statusFilter || String(associate.status || '').trim().toLowerCase() === statusFilter)
  ));
  const associateById = new Map(selectedAssociates.map((associate) => [Number(associate.id), associate]));
  const associateIds = selectedAssociates.map((associate) => associate.id);

  const rows = await Promise.all(
    associateIds.map(async (associateId) => {
      const [associate, contributions, distributions, installments] = await Promise.all([
        associateById.get(Number(associateId)) || associateRepository.findById(associateId),
        associateRepository.listContributionsByAssociate(associateId),
        associateRepository.listProfitDistributionsByAssociate(associateId),
        associateRepository.findInstallmentsByAssociateId(associateId),
      ]);
      const filteredContributions = contributions.filter((contribution) => (
        isWithinDateRange(contribution.contributionDate, dateRange)
      ));
      const filteredDistributions = distributions.filter((distribution) => (
        isWithinDateRange(distribution.distributionDate, dateRange)
      ));
      const filteredInstallments = installments.filter((installment) => (
        isWithinDateRange(installment.status === 'paid' ? installment.paidAt : installment.dueDate, dateRange)
      ));

      const normalizedDistributions = filteredDistributions.map(normalizeReportingDistributionRecord);
      const externalContributions = excludePairedReinvestmentContributions(filteredContributions, normalizedDistributions);
      const totalContributed = filterCapitalBearingContributions(externalContributions)
        .reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0);
      const totalDistributed = normalizedDistributions
        .filter(isDistributedProfit)
        .reduce((sum, distribution) => sum + Number(distribution.amount || 0), 0);
      const totalCapitalReturned = normalizedDistributions
        .filter((distribution) => distribution.distributionType === 'capital_return')
        .reduce((sum, distribution) => sum + Number(distribution.amount || 0), 0);
      const totalInterestPaid = filteredInstallments
        .filter((installment) => installment.status === 'paid')
        .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
      const interestDebt = filteredInstallments
        .filter(isUnpaidInterestInstallment)
        .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
      const nextInterestPayment = filteredInstallments
        .filter(isUnpaidInterestInstallment)
        .map((installment) => ({ installment, dueDate: toOperationalDateOrNull(installment.dueDate) }))
        .filter((entry) => entry.dueDate)
        .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())[0]?.installment || null;
      const baseFields = {
        interestType: formatInterestType(associate.interestType),
        interestRate: associate.interestRate || '0.0000',
        interestDebt: roundMoney(interestDebt),
        totalInterestPaid: roundMoney(totalInterestPaid),
        nextInterestPaymentDate: toExcelDate(nextInterestPayment?.dueDate),
      };

      const contributionRows = externalContributions.map((contribution) => ({
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: ASSOCIATE_EXPORT_SECTIONS.contribution,
        entryId: contribution.id,
        reference: '',
        amount: roundMoney(contribution.amount),
        date: toExcelDate(contribution.contributionDate),
        status: formatOperationalStatus(contribution.status || 'completed'),
        contributionInterestType: contribution.interestTypeSnapshot ? formatInterestType(contribution.interestTypeSnapshot) : 'No aplica',
        contributionInterestRate: contribution.interestRateSnapshot || 'No aplica',
        distributionType: '',
        notes: contribution.notes || '',
      }));

      const distributionRows = normalizedDistributions.map((distribution) => {
        const section = distribution.distributionType === 'capital_return'
          ? ASSOCIATE_EXPORT_SECTIONS.capitalReturn
          : (distribution.distributionType === 'reinvestment'
            ? ASSOCIATE_EXPORT_SECTIONS.reinvestment
            : ASSOCIATE_EXPORT_SECTIONS.distribution);
        return {
          associateId: associate.id,
          associateName: associate.name,
          ...baseFields,
          section,
          entryId: distribution.id,
          reference: distribution.loanId || '',
          amount: roundMoney(distribution.amount),
          date: toExcelDate(distribution.distributionDate),
          status: formatOperationalStatus(distribution.status),
          contributionInterestType: '',
          contributionInterestRate: '',
          distributionType: formatDistributionType(distribution.distributionType),
          notes: distribution.notes || '',
        };
      });

      const interestRows = filteredInstallments.map((installment) => {
        const operationalStatus = resolveInterestInstallmentExportStatus(installment);
        return {
          associateId: associate.id,
          associateName: associate.name,
          ...baseFields,
          section: operationalStatus === 'paid' ? ASSOCIATE_EXPORT_SECTIONS.interestPaid : ASSOCIATE_EXPORT_SECTIONS.interestDue,
          entryId: installment.id,
          reference: installment.installmentNumber || '',
          amount: roundMoney(installment.amount),
          date: toExcelDate(operationalStatus === 'paid' ? installment.paidAt : installment.dueDate),
          status: formatOperationalStatus(operationalStatus),
          contributionInterestType: '',
          contributionInterestRate: '',
          distributionType: associate.interestType === 'annual' ? 'Interés anual' : 'Interés mensual',
          notes: installment.notes || '',
        };
      });

      const summaryRow = {
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: ASSOCIATE_EXPORT_SECTIONS.summary,
        entryId: '',
        reference: '',
        amount: roundMoney(totalContributed),
        date: '',
        status: formatOperationalStatus(associate.status),
        contributionInterestType: '',
        contributionInterestRate: '',
        distributionType: '',
        notes: `Aportes: ${externalContributions.length}, Pagos manuales: ${distributionRows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.distribution).length}, Reinversiones: ${distributionRows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.reinvestment).length}, Devoluciones: ${distributionRows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.capitalReturn).length}, Cuotas de interés: ${filteredInstallments.length}. Pagado manualmente: ${formatDisplayMoney(totalDistributed)}. Capital devuelto: ${formatDisplayMoney(totalCapitalReturned)}`,
      };

      return [summaryRow, ...contributionRows, ...distributionRows, ...interestRows];
    }),
  );

  const flatRows = rows.flat();

  return {
    success: true,
    data: {
      rows: flatRows,
      sheets: buildAssociateSheets(flatRows),
    },
  };
};

const createExportAssociatesPdf = ({ associateRepository }) => async ({ actor, filters = {} }) => {
  const exportData = await createExportAssociatesExcel({ associateRepository })({ actor, filters });
  const rows = exportData.data?.rows || [];
  const associateIds = new Set(rows.map((row) => row.associateId).filter(Boolean));
  const contributionRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.contribution);
  const manualProfitabilityRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.distribution);
  const reinvestmentRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.reinvestment);
  const capitalReturnRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.capitalReturn);
  const interestPaidRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestPaid);
  const interestDueRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestDue);
  const totalContributed = contributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalManualProfitability = manualProfitabilityRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalReinvested = reinvestmentRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalCapitalReturned = capitalReturnRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestPaid = interestPaidRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestDue = interestDueRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const movementColumns = [
    { header: 'Socio', key: 'associateName' },
    { header: 'Fecha', key: 'date', width: 80 },
    { header: 'Monto', key: 'amount', width: 110, align: 'right', bold: true },
  ];
  const toMovementRows = (sectionRows) => sectionRows.map((row) => ({
    associateName: row.associateName || 'Socio sin nombre',
    date: formatExcelDisplayValue(row.date, 'dd/mm/yyyy').value || 'Sin fecha',
    amount: formatPdfMoney(row.amount),
  }));

  return {
    fileName: 'reporte-socios.pdf',
    contentType: 'application/pdf',
    buffer: await buildReportPdf({
      title: 'Socios inversionistas',
      subtitle: 'Capital, rentabilidad y movimientos registrados por socio.',
      summary: [
        { label: 'Socios incluidos', value: associateIds.size },
        { label: 'Capital aportado', value: formatPdfMoney(totalContributed) },
        ...(manualProfitabilityRows.length > 0
          ? [{ label: 'Pagos manuales de rentabilidad', value: formatPdfMoney(totalManualProfitability) }]
          : []),
        ...(reinvestmentRows.length > 0
          ? [{ label: 'Reinversiones', value: formatPdfMoney(totalReinvested) }]
          : []),
        ...(capitalReturnRows.length > 0
          ? [{ label: 'Capital devuelto', value: formatPdfMoney(totalCapitalReturned) }]
          : []),
        { label: 'Intereses pagados', value: formatPdfMoney(totalInterestPaid) },
        { label: 'Intereses pendientes', value: formatPdfMoney(totalInterestDue) },
      ],
      sections: [
        { heading: 'Aportes de capital', table: { columns: movementColumns, rows: toMovementRows(contributionRows) } },
        ...(manualProfitabilityRows.length > 0
          ? [{ heading: 'Pagos manuales de rentabilidad', table: { columns: movementColumns, rows: toMovementRows(manualProfitabilityRows) } }]
          : []),
        ...(reinvestmentRows.length > 0
          ? [{ heading: 'Reinversiones', table: { columns: movementColumns, rows: toMovementRows(reinvestmentRows) } }]
          : []),
        ...(capitalReturnRows.length > 0
          ? [{ heading: 'Devoluciones de capital', table: { columns: movementColumns, rows: toMovementRows(capitalReturnRows) } }]
          : []),
        { heading: 'Intereses pagados', table: { columns: movementColumns, rows: toMovementRows(interestPaidRows) } },
        { heading: 'Intereses pendientes', table: { columns: movementColumns, rows: toMovementRows(interestDueRows) } },
      ],
    }),
  };
};

const createGetAssociateMovementsReport = ({ associateRepository }) => async ({ actor, filters = {} }) => {
  const exportData = await createExportAssociatesExcel({ associateRepository })({ actor, filters });
  const movementTypeBySection = {
    [ASSOCIATE_EXPORT_SECTIONS.contribution]: 'contribution',
    [ASSOCIATE_EXPORT_SECTIONS.distribution]: 'manual_profitability',
    [ASSOCIATE_EXPORT_SECTIONS.reinvestment]: 'reinvestment',
    [ASSOCIATE_EXPORT_SECTIONS.capitalReturn]: 'capital_return',
    [ASSOCIATE_EXPORT_SECTIONS.interestPaid]: 'scheduled_profitability_paid',
    [ASSOCIATE_EXPORT_SECTIONS.interestDue]: 'scheduled_profitability_pending',
  };
  const rows = (exportData.data?.rows || [])
    .filter((row) => row.section !== ASSOCIATE_EXPORT_SECTIONS.summary)
    .map((row) => ({
      id: row.entryId,
      associateId: row.associateId,
      associateName: row.associateName,
      movementType: movementTypeBySection[row.section],
      reference: row.reference,
      amount: parseMoney(row.amount),
      date: row.date,
    }));

  return {
    rows,
    summary: rows.reduce((result, row) => {
      const amount = parseMoney(row.amount);
      result.totalMovements += 1;
      result.totalAmount += amount;
      if (row.movementType === 'contribution') result.contributions += amount;
      if (row.movementType === 'reinvestment') result.reinvestments += amount;
      if (row.movementType === 'capital_return') result.capitalReturns += amount;
      if (['scheduled_profitability_paid', 'manual_profitability'].includes(row.movementType)) result.profitabilityPaid += amount;
      if (row.movementType === 'scheduled_profitability_pending') result.profitabilityPending += amount;
      return result;
    }, {
      totalMovements: 0,
      totalAmount: 0,
      contributions: 0,
      reinvestments: 0,
      capitalReturns: 0,
      profitabilityPaid: 0,
      profitabilityPending: 0,
    }),
  };
};

const createGetAssociateFinancialSummary = ({ associateRepository }) => async ({ actor, associateId = null }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder al resumen financiero de socios.');

  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  const [contributions, distributions, installments] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
    typeof associateRepository.findInstallmentsByAssociateId === 'function'
      ? associateRepository.findInstallmentsByAssociateId(associate.id)
      : Promise.resolve([]),
  ]);

  const totalContributed = filterCapitalBearingContributions(contributions)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const normalizedDistributions = distributions.map(normalizeReportingDistributionRecord);
  const totalDistributed = normalizedDistributions
    .filter(isDistributedProfit)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalCapitalReturned = normalizedDistributions
    .filter((item) => item.distributionType === 'capital_return')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const normalizedInstallments = Array.isArray(installments) ? installments : [];
  const paidInstallments = normalizedInstallments.filter((installment) => installment.status === 'paid');
  const unpaidInstallments = normalizedInstallments.filter(isUnpaidInterestInstallment);
  const totalInterestPaid = paidInstallments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const interestDebt = unpaidInstallments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const nextInterestPayment = unpaidInstallments
    .map((installment) => ({ installment, dueDate: toOperationalDateOrNull(installment.dueDate) }))
    .filter((entry) => entry.dueDate)
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())[0]?.installment || null;

  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: totalContributed.toFixed(2),
      totalDistributed: totalDistributed.toFixed(2),
      totalCapitalReturned: totalCapitalReturned.toFixed(2),
      totalInterestPaid: totalInterestPaid.toFixed(2),
      interestDebt: interestDebt.toFixed(2),
      nextInterestPaymentDate: nextInterestPayment?.dueDate || null,
      netProfit: (totalDistributed + totalInterestPaid).toFixed(2),
      contributionCount: contributions.length,
      distributionCount: normalizedDistributions.filter(isDistributedProfit).length,
      installmentCount: normalizedInstallments.length,
      paidInstallmentCount: paidInstallments.length,
      pendingInstallmentCount: unpaidInstallments.length,
    },
    data: {
      contributions,
      distributions: normalizedDistributions,
      installments: normalizedInstallments,
    },
  };
};

const createExportAssociateFinancialSummary = ({ associateRepository }) => async ({ actor, associateId, format = 'xlsx' }) => {
  const report = await createGetAssociateFinancialSummary({ associateRepository })({ actor, associateId });
  const contributions = Array.isArray(report.data?.contributions) ? report.data.contributions : [];
  const distributions = Array.isArray(report.data?.distributions) ? report.data.distributions : [];
  const installments = Array.isArray(report.data?.installments) ? report.data.installments : [];

  const contributionRows = (contributions || []).map((entry) => ({
    contributionId: entry.id,
    amount: entry.amount,
    contributionDate: entry.contributionDate,
    notes: entry.notes || '',
  }));
  const distributionRows = (distributions || []).map((entry) => {
    const normalizedEntry = normalizeReportingDistributionRecord(entry);

    return {
      distributionId: entry.id,
      creditId: entry.loanId,
      amount: entry.amount,
      distributionDate: entry.distributionDate,
      distributionType: formatAssociateDistributionType(normalizedEntry.distributionType),
      notes: entry.notes || '',
    };
  });
  const manualProfitabilityRows = distributionRows.filter((row) => row.distributionType === 'Pago manual de rentabilidad');
  const capitalReturnRows = distributionRows.filter((row) => row.distributionType === 'Devolución de capital');
  const reinvestmentRows = distributionRows.filter((row) => row.distributionType === 'Reinversión');
  const installmentRows = (installments || []).map((entry) => {
    const operationalStatus = resolveInterestInstallmentExportStatus(entry);
    return {
      installmentNumber: entry.installmentNumber,
      amount: entry.amount,
      dueDate: entry.dueDate,
      paidAt: entry.paidAt || '',
      status: formatOperationalStatus(operationalStatus),
      paymentMethod: entry.paymentMethod || '',
      paidBy: entry.paidByUser?.name || entry.paidByUser?.email || '',
      notes: entry.notes || '',
    };
  });

  if (format === 'csv') {
    const csv = buildCsv({
      headers: ['Sección', 'ID', 'Referencia', 'Monto', 'Fecha', 'Estado', 'Tipo de Movimiento', 'Notas'],
      rows: [
        ...contributionRows.map((row) => ['Aporte', row.contributionId, '', row.amount, row.contributionDate, '', '', row.notes]),
        ...distributionRows.map((row) => [
          row.distributionType,
          row.distributionId,
          row.creditId || '',
          row.amount,
          row.distributionDate,
          '',
          row.distributionType,
          row.notes,
        ]),
        ...installmentRows.map((row) => [
          'Cronograma de intereses',
          row.installmentNumber || '',
          '',
          row.amount,
          row.paidAt || row.dueDate,
          row.status,
          report.associate?.interestType === 'annual' ? 'Interés anual' : 'Interés mensual',
          row.notes,
        ]),
      ],
    });

    return {
      fileName: `associate-${report.associate.id}-financial-summary.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `associate-${report.associate.id}-financial-summary.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await buildWorkbookBuffer([
      {
        name: 'Resumen General',
        title: `CONTROL FINANCIERO DEL SOCIO - ${report.associate.name}`,
        tabColor: STYLE_COLORS.blue,
        headerFill: STYLE_COLORS.green,
        columns: ASSOCIATE_FINANCIAL_SUMMARY_COLUMNS,
        rows: [
          { indicator: 'Socio', value: report.associate.name },
          { indicator: 'ID Socio', value: report.associate.id },
          { indicator: 'Aportes Totales', value: Number(report.summary.totalContributed || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Pagos manuales de rentabilidad', value: Number(report.summary.totalDistributed || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Capital Devuelto', value: Number(report.summary.totalCapitalReturned || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Interés Pagado', value: Number(report.summary.totalInterestPaid || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Interés Pendiente', value: Number(report.summary.interestDebt || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Próximo Pago', value: toExcelDate(report.summary.nextInterestPaymentDate) || '' },
          { indicator: 'Rentabilidad pagada', value: Number(report.summary.netProfit || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Cantidad de Aportes', value: report.summary.contributionCount || 0 },
          { indicator: 'Cantidad de pagos manuales', value: report.summary.distributionCount || 0 },
          { indicator: 'Cuotas de interés', value: report.summary.installmentCount || 0 },
          { indicator: 'Cuotas pendientes', value: report.summary.pendingInstallmentCount || 0 },
        ],
        autoFilter: false,
      },
      {
        name: 'Aportes',
        title: 'APORTES DEL SOCIO',
        tabColor: STYLE_COLORS.green,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_CONTRIBUTION_COLUMNS,
        rows: contributionRows,
      },
      {
        name: 'Pagos manuales',
        title: 'PAGOS MANUALES DEL SOCIO',
        tabColor: STYLE_COLORS.yellow,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_DISTRIBUTION_COLUMNS,
        rows: manualProfitabilityRows,
      },
      {
        name: 'Devoluciones de capital',
        title: 'DEVOLUCIONES DE CAPITAL DEL SOCIO',
        tabColor: STYLE_COLORS.blue,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_DISTRIBUTION_COLUMNS,
        rows: capitalReturnRows,
      },
      {
        name: 'Reinversiones',
        title: 'REINVERSIONES DEL SOCIO',
        tabColor: STYLE_COLORS.purple,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_DISTRIBUTION_COLUMNS,
        rows: reinvestmentRows,
      },
      {
        name: 'Cronograma',
        title: 'CRONOGRAMA DE INTERESES DEL SOCIO',
        tabColor: STYLE_COLORS.purple,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_INSTALLMENT_COLUMNS,
        rows: installmentRows,
      },
    ]),
  };
};

module.exports = {
  createExportAssociatesExcel,
  createExportAssociatesPdf,
  createGetAssociateMovementsReport,
  createGetAssociateFinancialSummary,
  createExportAssociateFinancialSummary,
};
