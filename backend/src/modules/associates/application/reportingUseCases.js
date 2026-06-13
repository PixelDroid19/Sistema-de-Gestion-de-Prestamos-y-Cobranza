const { NotFoundError } = require('@/utils/errorHandler');
const { toOperationalDateOrNull } = require('@/modules/shared/dateUtils');
const {
  ensureAdmin,
  formatMoney,
  formatDisplayMoney,
  assertDateRangeOrder,
} = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus } = require('@/modules/reports/application/reportLabels');
const { buildWorkbookBuffer, STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const {
  buildCsv,
  buildPdfBuffer,
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
} = require('@/modules/reports/application/excelExportFormats');
const {
  normalizeAssociateRecord,
  normalizeParticipationPercentage,
} = require('./useCases');

const ASSOCIATE_DISTRIBUTION_TYPE_LABELS = {
  proportional: 'Proporcional',
  fixed: 'Fija',
  manual: 'Manual',
  reinvestment: 'Reinversión',
  capital_return: 'Devolución de capital',
};

const ASSOCIATE_EXPORT_SECTIONS = {
  summary: 'Resumen',
  contribution: 'Aporte',
  distribution: 'Distribución',
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
  { header: 'Participación %', key: 'participationPercentage', width: 18, numFmt: TNA_FORMAT },
  { header: 'Rentabilidad del Aporte', key: 'contributionInterestType', width: 24 },
  { header: 'Tasa Histórica del Aporte %', key: 'contributionInterestRate', width: 28, numFmt: TNA_FORMAT },
  { header: 'Tipo Distribución', key: 'distributionType', width: 20 },
  moneyColumn('Total Declarado', 'declaredProportionalTotal', 20),
  moneyColumn('Monto Asignado', 'allocatedAmount', 20),
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

const ASSOCIATE_PROFITABILITY_SUMMARY_COLUMNS = [
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
  { header: 'ID Distribución', key: 'distributionId', width: 16 },
  { header: 'Referencia', key: 'creditId', width: 18 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha Distribución', 'distributionDate', 20),
  { header: 'Tipo Distribución', key: 'distributionType', width: 20 },
  { header: 'Participación %', key: 'participationPercentage', width: 18, numFmt: TNA_FORMAT },
  moneyColumn('Total Proporcional', 'declaredProportionalTotal', 20),
  moneyColumn('Monto Asignado', 'allocatedAmount', 20),
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
      : (serializedDistribution?.distributionType || (basis.type === 'proportional-participation' ? 'proportional' : 'manual')));
  const isProportional = distributionType === 'proportional';

  return {
    ...serializedDistribution,
    distributionType,
    participationPercentage: normalizeParticipationPercentage(
      serializedDistribution?.participationPercentage ?? basis.participationPercentage,
    ),
    declaredProportionalTotal: isProportional
      ? (serializedDistribution?.declaredProportionalTotal || basis.sourceAmount || null)
      : (serializedDistribution?.declaredProportionalTotal || null),
    allocatedAmount: isProportional
      ? (serializedDistribution?.allocatedAmount || basis.allocatedAmount || null)
      : (serializedDistribution?.allocatedAmount || null),
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

const normalizeDateFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return toOperationalDateOrNull(value);
};

const buildDateRangeFilter = (filters = {}) => {
  const range = {
    fromDate: normalizeDateFilter(filters.fromDate || filters.startDate),
    toDate: normalizeDateFilter(filters.toDate || filters.endDate),
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

const formatDistributionType = (value) => {
  if (!value) return 'N/A';
  return ASSOCIATE_DISTRIBUTION_TYPE_LABELS[String(value).trim().toLowerCase()] || 'Tipo de distribución no clasificado';
};

const formatAssociateDistributionType = (value) => (
  ASSOCIATE_DISTRIBUTION_TYPE_LABELS[String(value || '').trim().toLowerCase()] || (value ? 'Tipo de distribución no clasificado' : '')
);

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
  const capitalReturnRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.capitalReturn);
  const interestRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestPaid || row.section === ASSOCIATE_EXPORT_SECTIONS.interestDue);
  const totalContributed = contributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalDistributed = distributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalCapitalReturned = capitalReturnRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestPaid = interestRows.filter((row) => row.status === 'Pagado').reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestDebt = interestRows.filter((row) => row.status !== 'Pagado').reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const movementRows = rows.filter((row) => row.section !== ASSOCIATE_EXPORT_SECTIONS.summary);
  const byStatus = Array.from(movementRows.reduce((map, row) => {
    const status = row.status || 'N/A';
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
    const section = row.section || 'N/A';
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
        { ...indicatorRow('Distribuciones Totales', roundMoney(totalDistributed), MONEY_FORMAT), description: 'Intereses o utilidades reconocidas al socio' },
        { ...indicatorRow('Capital Devuelto', roundMoney(totalCapitalReturned), MONEY_FORMAT), description: 'Capital reintegrado al socio' },
        { ...indicatorRow('Interés Pagado', roundMoney(totalInterestPaid), MONEY_FORMAT), description: 'Intereses pagados a socios' },
        { ...indicatorRow('Deuda con Socios', roundMoney(totalInterestDebt), MONEY_FORMAT), description: 'Intereses programados pendientes de pago' },
      ],
      autoFilter: false,
    },
    {
      name: 'Distribución por Estado',
      title: 'DISTRIBUCIÓN DE SOCIOS POR ESTADO',
      tabColor: STYLE_COLORS.yellow,
      headerFill: STYLE_COLORS.headerBlue,
      columns: STATUS_COLUMNS,
      rows: byStatus,
    },
    {
      name: 'Creación por Mes',
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
      name: 'Análisis de Rentabilidad',
      title: 'ANÁLISIS DE RENTABILIDAD',
      tabColor: STYLE_COLORS.purple,
      headerFill: STYLE_COLORS.headerBlue,
      columns: SUMMARY_COLUMNS,
      rows: [
        { ...indicatorRow('Aportes Totales', roundMoney(totalContributed), MONEY_FORMAT), description: 'Capital aportado por socios' },
        { ...indicatorRow('Distribuciones Totales', roundMoney(totalDistributed), MONEY_FORMAT), description: 'Utilidad repartida' },
        { ...indicatorRow('Capital Devuelto', roundMoney(totalCapitalReturned), MONEY_FORMAT), description: 'Capital reintegrado a socios' },
        { ...indicatorRow('Interés Pagado', roundMoney(totalInterestPaid), MONEY_FORMAT), description: 'Pagos de intereses ejecutados' },
        { ...indicatorRow('Interés Pendiente', roundMoney(totalInterestDebt), MONEY_FORMAT), description: 'Estado de deuda con socios' },
        {
          ...indicatorRow(
            'Rentabilidad sobre Aportes',
            totalContributed > 0 ? totalDistributed / totalContributed : 0,
            PERCENT_FORMAT,
          ),
          description: 'Distribuciones sobre aportes',
        },
      ],
      autoFilter: false,
    },
    {
      name: 'Rangos de Inversión',
      title: 'DISTRIBUCIÓN POR RANGOS DE INVERSIÓN',
      tabColor: STYLE_COLORS.teal,
      headerFill: STYLE_COLORS.headerBlue,
      columns: SECTION_COLUMNS,
      rows: [
        { section: 'Aportes', count: contributionRows.length, amount: roundMoney(totalContributed) },
        { section: 'Distribuciones', count: distributionRows.length, amount: roundMoney(totalDistributed) },
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
  const statusFilter = normalizeAssociateStatusFilter(filters.status);
  const dateRange = buildDateRangeFilter(filters);
  const associates = associateIdFilter
    ? [await associateRepository.findById(associateIdFilter)].filter(Boolean)
    : await associateRepository.list();
  const selectedAssociates = associates.filter((associate) => (
    !statusFilter || String(associate.status || '').trim().toLowerCase() === statusFilter
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

      const totalContributed = filteredContributions.reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0);
      const normalizedDistributions = filteredDistributions.map(normalizeReportingDistributionRecord);
      const totalDistributed = normalizedDistributions
        .filter((distribution) => distribution.distributionType !== 'capital_return')
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

      const contributionRows = filteredContributions.map((contribution) => ({
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: ASSOCIATE_EXPORT_SECTIONS.contribution,
        entryId: contribution.id,
        reference: '',
        amount: roundMoney(contribution.amount),
        date: toExcelDate(contribution.contributionDate),
        status: formatOperationalStatus(contribution.status || 'completed'),
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        contributionInterestType: contribution.interestTypeSnapshot ? formatInterestType(contribution.interestTypeSnapshot) : 'N/A',
        contributionInterestRate: contribution.interestRateSnapshot || 'N/A',
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: contribution.notes || '',
      }));

      const distributionRows = normalizedDistributions.map((distribution) => {
        const section = distribution.distributionType === 'capital_return'
          ? ASSOCIATE_EXPORT_SECTIONS.capitalReturn
          : ASSOCIATE_EXPORT_SECTIONS.distribution;
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
          participationPercentage: distribution.participationPercentage || normalizeParticipationPercentage(associate.participationPercentage),
          contributionInterestType: '',
          contributionInterestRate: '',
          distributionType: formatDistributionType(distribution.distributionType),
          declaredProportionalTotal: distribution.declaredProportionalTotal || 'N/A',
          allocatedAmount: distribution.allocatedAmount || 'N/A',
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
          participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
          contributionInterestType: '',
          contributionInterestRate: '',
          distributionType: associate.interestType === 'annual' ? 'Interés anual' : 'Interés mensual',
          declaredProportionalTotal: '',
          allocatedAmount: '',
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
        amount: formatMoney(totalContributed),
        date: `Distribuido: ${formatDisplayMoney(totalDistributed)} · Devuelto: ${formatDisplayMoney(totalCapitalReturned)}`,
        status: formatOperationalStatus(associate.status),
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        contributionInterestType: '',
        contributionInterestRate: '',
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: `Aportes: ${filteredContributions.length}, Distribuciones: ${distributionRows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.distribution).length}, Devoluciones: ${distributionRows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.capitalReturn).length}, Cuotas de interés: ${filteredInstallments.length}`,
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

const buildAssociatesPdfLines = (rows = []) => {
  const associateIds = new Set(rows.map((row) => row.associateId).filter(Boolean));
  const contributionRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.contribution);
  const interestPaidRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestPaid);
  const interestDueRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestDue);
  const totalContributed = contributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestPaid = interestPaidRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestDue = interestDueRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const paidLines = interestPaidRows.slice(0, 5).map((row) => (
    `Pagado: ${row.associateName || 'Socio sin nombre'} - ${row.date || 'Sin fecha'} - ${formatPdfMoney(row.amount)}`
  ));
  const pendingScheduleLines = interestDueRows.slice(0, 8).map((row) => (
    `Pendiente: ${row.associateName || 'Socio sin nombre'} - ${row.date || 'Sin fecha'} - ${formatPdfMoney(row.amount)}`
  ));

  return [
    `Socios incluidos: ${associateIds.size}`,
    `Capital aportado por socios: ${formatPdfMoney(totalContributed)}`,
    `Pagos realizados a socios: ${formatPdfMoney(totalInterestPaid)}`,
    `Intereses pendientes de socios: ${formatPdfMoney(totalInterestDue)}`,
    `Cronograma de pagos de socios: ${interestDueRows.length} cuota${interestDueRows.length === 1 ? '' : 's'}`,
    ...paidLines,
    ...pendingScheduleLines,
  ];
};

const createExportAssociatesPdf = ({ associateRepository }) => async ({ actor, filters = {} }) => {
  const exportData = await createExportAssociatesExcel({ associateRepository })({ actor, filters });
  const rows = exportData.data?.rows || [];

  return {
    fileName: 'associates-export.pdf',
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: 'REPORTE DE SOCIOS INVERSIONISTAS',
      lines: buildAssociatesPdfLines(rows),
    }),
  };
};

const createGetAssociateProfitabilityReport = ({ associateRepository }) => async ({ actor, associateId = null }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder a reportes de rentabilidad.');

  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  const [contributions, distributions] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
  ]);

  const totalContributed = contributions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const normalizedDistributions = distributions.map(normalizeReportingDistributionRecord);
  const totalDistributed = normalizedDistributions
    .filter((item) => item.distributionType !== 'capital_return')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalCapitalReturned = normalizedDistributions
    .filter((item) => item.distributionType === 'capital_return')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: totalContributed.toFixed(2),
      totalDistributed: totalDistributed.toFixed(2),
      totalCapitalReturned: totalCapitalReturned.toFixed(2),
      netProfit: totalDistributed.toFixed(2),
      contributionCount: contributions.length,
      distributionCount: normalizedDistributions.filter((item) => item.distributionType !== 'capital_return').length,
      participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
    },
    data: {
      contributions,
      distributions: normalizedDistributions,
    },
  };
};

const createExportAssociateProfitabilityReport = ({ associateRepository }) => async ({ actor, associateId, format = 'xlsx' }) => {
  const report = await createGetAssociateProfitabilityReport({ associateRepository })({ actor, associateId });
  const [contributions, distributions] = await Promise.all([
    associateRepository.listContributionsByAssociate(report.associate.id),
    associateRepository.listProfitDistributionsByAssociate(report.associate.id),
  ]);

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
      participationPercentage: normalizedEntry.participationPercentage || normalizeParticipationPercentage(report.associate?.participationPercentage),
      declaredProportionalTotal: normalizedEntry.declaredProportionalTotal,
      allocatedAmount: normalizedEntry.allocatedAmount,
      notes: entry.notes || '',
    };
  });

  if (format === 'csv') {
    const csv = buildCsv({
      headers: ['Sección', 'ID', 'Referencia', 'Monto', 'Fecha', 'Estado', 'Participación %', 'Tipo Distribución', 'Total Proporcional', 'Monto Asignado', 'Notas'],
      rows: [
        ...contributionRows.map((row) => ['Aporte', row.contributionId, '', row.amount, row.contributionDate, '', normalizeParticipationPercentage(report.associate?.participationPercentage), '', '', '', row.notes]),
        ...distributionRows.map((row) => [
          'Distribución',
          row.distributionId,
          row.creditId || '',
          row.amount,
          row.distributionDate,
          '',
          row.participationPercentage || '',
          row.distributionType,
          row.declaredProportionalTotal || '',
          row.allocatedAmount || '',
          row.notes,
        ]),
      ],
    });

    return {
      fileName: `associate-${report.associate.id}-profitability.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `associate-${report.associate.id}-profitability.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await buildWorkbookBuffer([
      {
        name: 'Resumen General',
        title: `RENTABILIDAD DEL SOCIO - ${report.associate.name}`,
        tabColor: STYLE_COLORS.blue,
        headerFill: STYLE_COLORS.green,
        columns: ASSOCIATE_PROFITABILITY_SUMMARY_COLUMNS,
        rows: [
          { indicator: 'Socio', value: report.associate.name },
          { indicator: 'ID Socio', value: report.associate.id },
          { indicator: 'Aportes Totales', value: Number(report.summary.totalContributed || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Distribuciones Totales', value: Number(report.summary.totalDistributed || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Capital Devuelto', value: Number(report.summary.totalCapitalReturned || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Ganancia Neta', value: Number(report.summary.netProfit || 0), __formats: { value: { numFmt: MONEY_FORMAT } } },
          { indicator: 'Cantidad de Aportes', value: report.summary.contributionCount || 0 },
          { indicator: 'Cantidad de Distribuciones', value: report.summary.distributionCount || 0 },
          { indicator: 'Participación', value: report.summary.participationPercentage || '0.0000', __formats: { value: { numFmt: TNA_FORMAT } } },
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
        name: 'Distribuciones',
        title: 'DISTRIBUCIONES DEL SOCIO',
        tabColor: STYLE_COLORS.yellow,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_DISTRIBUTION_COLUMNS,
        rows: distributionRows,
      },
    ]),
  };
};

module.exports = {
  createExportAssociatesExcel,
  createExportAssociatesPdf,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
};
