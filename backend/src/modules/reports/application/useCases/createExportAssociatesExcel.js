const {
  assertDateRangeOrder,
  ensureAdmin,
  formatMoney,
  buildPdfBuffer,
} = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus } = require('@/modules/reports/application/reportLabels');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const { toDateOnlyOrNull, toOperationalDateOrNull } = require('@/modules/shared/dateUtils');

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: '"$"#,##0.00' });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: 'dd/mm/yyyy' });
const ASSOCIATE_EXPORT_SECTIONS = {
  summary: 'Resumen',
  contribution: 'Aporte',
  distribution: 'Distribución',
  interestPaid: 'Interés pagado',
  interestDue: 'Interés pendiente',
};

const normalizeParticipationPercentage = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number(value).toFixed(4);
};

const normalizeDistributionRecord = (distribution) => {
  const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;

  return {
    ...serializedDistribution,
    distributionType: serializedDistribution?.distributionType || 'proportional',
    participationPercentage: normalizeParticipationPercentage(serializedDistribution?.participationPercentage),
    declaredProportionalTotal: serializedDistribution?.declaredProportionalTotal || null,
    allocatedAmount: serializedDistribution?.allocatedAmount || null,
  };
};

const DISTRIBUTION_TYPE_LABELS = {
  proportional: 'Proporcional',
  manual: 'Manual',
  fixed: 'Fija',
};

/**
 * Formats associate distribution type values for operational export rows.
 *
 * @param {string} value Raw distribution type stored on the movement.
 * @returns {string} Spanish operational label for Excel/CSV exports.
 */
const formatDistributionType = (value) => {
  if (!value) return 'N/A';
  return DISTRIBUTION_TYPE_LABELS[String(value).trim().toLowerCase()] || 'Tipo de distribución no clasificado';
};

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  return toDateOnlyOrNull(value) || 'N/A';
};

const formatInterestType = (value) => (value === 'annual' ? 'Anual' : 'Mensual');

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

const SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'indicator', width: 34 },
  { header: 'Valor', key: 'value', width: 22 },
  { header: 'Unidad', key: 'unit', width: 15 },
  { header: 'Descripción', key: 'description', width: 42 },
];

const DETAIL_COLUMNS = [
  { header: 'ID Socio', key: 'associateId', width: 12 },
  { header: 'Socio', key: 'associateName', width: 28 },
  { header: 'Tipo de Interés', key: 'interestType', width: 18 },
  { header: 'Tasa Pactada %', key: 'interestRate', width: 18 },
  moneyColumn('Deuda con Socio', 'interestDebt', 20),
  moneyColumn('Interés Pagado', 'totalInterestPaid', 20),
  dateColumn('Próximo Pago', 'nextInterestPaymentDate', 18),
  { header: 'Sección', key: 'section', width: 16 },
  { header: 'ID Movimiento', key: 'entryId', width: 16 },
  { header: 'Referencia', key: 'reference', width: 24 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha', 'date', 18),
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Participación %', key: 'participationPercentage', width: 18 },
  { header: 'Rentabilidad del Aporte', key: 'contributionInterestType', width: 24 },
  { header: 'Tasa Histórica del Aporte %', key: 'contributionInterestRate', width: 28 },
  { header: 'Tipo Distribución', key: 'distributionType', width: 20 },
  moneyColumn('Total Declarado', 'declaredProportionalTotal', 20),
  moneyColumn('Monto Asignado', 'allocatedAmount', 20),
  { header: 'Notas', key: 'notes', width: 34 },
];

const STATUS_COLUMNS = [
  { header: 'Estado', key: 'status', width: 18 },
  { header: 'Cantidad', key: 'count', width: 14 },
  moneyColumn('Monto Total', 'amount'),
  { header: 'Porcentaje', key: 'percentage', width: 14 },
];

const SECTION_COLUMNS = [
  { header: 'Sección', key: 'section', width: 18 },
  { header: 'Cantidad', key: 'count', width: 14 },
  moneyColumn('Monto Total', 'amount'),
];

const parseMoney = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const formatPdfMoney = (value) => `$${Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;
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

const buildAssociateSheets = (rows) => {
  const associateIds = new Set(rows.map((row) => row.associateId).filter(Boolean));
  const contributionRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.contribution);
  const distributionRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.distribution);
  const interestRows = rows.filter((row) => row.section === ASSOCIATE_EXPORT_SECTIONS.interestPaid || row.section === ASSOCIATE_EXPORT_SECTIONS.interestDue);
  const totalContributed = contributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalDistributed = distributionRows.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestPaid = interestRows.filter((row) => row.status === 'Pagado').reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const totalInterestDebt = interestRows.filter((row) => row.status !== 'Pagado').reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const byStatus = Array.from(rows.reduce((map, row) => {
    const status = row.status || 'N/A';
    const current = map.get(status) || { status, count: 0, amount: 0 };
    current.count += 1;
    current.amount += parseMoney(row.amount);
    map.set(status, current);
    return map;
  }, new Map()).values()).map((row) => ({
    ...row,
    percentage: rows.length > 0 ? `${((row.count / rows.length) * 100).toFixed(2)}%` : '0.00%',
  }));
  const bySection = Array.from(rows.reduce((map, row) => {
    const section = row.section || 'N/A';
    const current = map.get(section) || { section, count: 0, amount: 0 };
    current.count += 1;
    current.amount += parseMoney(row.amount);
    map.set(section, current);
    return map;
  }, new Map()).values());

  return [
    {
      name: 'Resumen General',
      title: 'REPORTE GENERAL DE SOCIOS',
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: SUMMARY_COLUMNS,
      rows: [
        { indicator: 'Total de Socios', value: associateIds.size, unit: 'socios', description: 'Número total de socios incluidos en el reporte' },
        { indicator: 'Aportes Totales', value: totalContributed, unit: '$', description: 'Suma de aportes registrados' },
        { indicator: 'Distribuciones Totales', value: totalDistributed, unit: '$', description: 'Ganancias distribuidas a socios' },
        { indicator: 'Interés Pagado', value: totalInterestPaid, unit: '$', description: 'Intereses pagados a socios' },
        { indicator: 'Deuda con Socios', value: totalInterestDebt, unit: '$', description: 'Intereses programados pendientes de pago' },
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
        { indicator: 'Aportes Totales', value: totalContributed, unit: '$', description: 'Capital aportado por socios' },
        { indicator: 'Distribuciones Totales', value: totalDistributed, unit: '$', description: 'Utilidad repartida' },
        { indicator: 'Interés Pagado', value: totalInterestPaid, unit: '$', description: 'Pagos de intereses ejecutados' },
        { indicator: 'Interés Pendiente', value: totalInterestDebt, unit: '$', description: 'Estado de deuda con socios' },
        { indicator: 'Rentabilidad sobre Aportes', value: totalContributed > 0 ? `${((totalDistributed / totalContributed) * 100).toFixed(2)}%` : '0.00%', unit: '%', description: 'Distribuciones sobre aportes' },
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
        { section: 'Aportes', count: contributionRows.length, amount: totalContributed },
        { section: 'Distribuciones', count: distributionRows.length, amount: totalDistributed },
        { section: 'Intereses pagados', count: interestRows.filter((row) => row.status === 'Pagado').length, amount: totalInterestPaid },
        { section: 'Intereses pendientes', count: interestRows.filter((row) => row.status !== 'Pagado').length, amount: totalInterestDebt },
      ],
    },
  ];
};

/**
 * Create use case: Export Associates to Excel
 * Exports all associates with their contributions, distributions, interest installments, reinvestments, and debt status.
 * This is an administrative report for backoffice actors with report permission;
 * socio records are investment records, not login roles for this route.
 * GET /api/reports/associates/excel
 *
 * @param {{ associateRepository: object, reportRepository?: object }} dependencies
 * @returns {(input: { actor: { id?: number|string, role: string }, filters?: { associateId?: number|string } }) => Promise<{ success: boolean, data: { rows: Array<object>, sheets: Array<object> } }>}
 */
const createExportAssociatesExcel = ({ associateRepository, reportRepository }) => async ({ actor, filters = {} }) => {
  ensureAdmin(actor, 'Only authorized backoffice users can export associates data');
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

  // Build rows for each associate
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

      const totalContributed = filteredContributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const totalDistributed = filteredDistributions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
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
        interestDebt: formatMoney(interestDebt),
        totalInterestPaid: formatMoney(totalInterestPaid),
        nextInterestPaymentDate: formatIsoDate(nextInterestPayment?.dueDate),
      };

      // Contribution rows
      const contributionRows = filteredContributions.map((c) => ({
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: ASSOCIATE_EXPORT_SECTIONS.contribution,
        entryId: c.id,
        reference: '',
        amount: formatMoney(c.amount),
        date: formatIsoDate(c.contributionDate),
        status: formatOperationalStatus(c.status),
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        contributionInterestType: c.interestTypeSnapshot ? formatInterestType(c.interestTypeSnapshot) : 'N/A',
        contributionInterestRate: c.interestRateSnapshot || 'N/A',
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: c.notes || '',
      }));

      // Distribution rows
      const distributionRows = filteredDistributions.map((d) => {
        const normalized = normalizeDistributionRecord(d);
        return {
          associateId: associate.id,
          associateName: associate.name,
          ...baseFields,
          section: ASSOCIATE_EXPORT_SECTIONS.distribution,
          entryId: d.id,
          reference: d.loanId || '',
          amount: formatMoney(d.amount),
          date: formatIsoDate(d.distributionDate),
          status: formatOperationalStatus(d.status),
          participationPercentage: normalized.participationPercentage || normalizeParticipationPercentage(associate.participationPercentage),
          contributionInterestType: '',
          contributionInterestRate: '',
          distributionType: formatDistributionType(normalized.distributionType),
          declaredProportionalTotal: normalized.declaredProportionalTotal || 'N/A',
          allocatedAmount: normalized.allocatedAmount || 'N/A',
          notes: d.notes || '',
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
          amount: formatMoney(installment.amount),
          date: formatIsoDate(operationalStatus === 'paid' ? installment.paidAt : installment.dueDate),
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

      // Summary row
      const summaryRow = {
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: ASSOCIATE_EXPORT_SECTIONS.summary,
        entryId: '',
        reference: '',
        amount: formatMoney(totalContributed),
        date: `Distribuido: ${formatMoney(totalDistributed)}`,
        status: formatOperationalStatus(associate.status),
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        contributionInterestType: '',
        contributionInterestRate: '',
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: `Aportes: ${filteredContributions.length}, Distribuciones: ${filteredDistributions.length}, Cuotas de interés: ${filteredInstallments.length}`,
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
    `Pagado: ${row.associateName || 'Socio sin nombre'} - ${row.date || 'Sin fecha'} - ${row.amount || '$0.00'}`
  ));
  const pendingScheduleLines = interestDueRows.slice(0, 8).map((row) => (
    `Pendiente: ${row.associateName || 'Socio sin nombre'} - ${row.date || 'Sin fecha'} - ${row.amount || '$0.00'}`
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

const createExportAssociatesPdf = ({ associateRepository, reportRepository }) => async ({ actor, filters = {} }) => {
  const exportData = await createExportAssociatesExcel({ associateRepository, reportRepository })({ actor, filters });
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

module.exports = { createExportAssociatesExcel, createExportAssociatesPdf };
