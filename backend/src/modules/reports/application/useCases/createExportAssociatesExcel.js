const { AuthorizationError } = require('@/utils/errorHandler');
const { ensureAdminOrSocio, formatMoney } = require('@/modules/reports/application/reportHelpers');
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

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  return toDateOnlyOrNull(value) || 'N/A';
};

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
 * GET /api/reports/associates/excel
 */
const createExportAssociatesExcel = ({ associateRepository, reportRepository }) => async ({ actor }) => {
  ensureAdminOrSocio(actor, 'Only admins and socios can export associates data');

  // Admin can export all, socio can only export self
  let associateIds;
  if (actor.role === 'admin') {
    // Get all associate IDs
    const allAssociates = await associateRepository.list();
    associateIds = allAssociates.map((a) => a.id);
  } else {
    // Socio can only export their own data
    const associate = await associateRepository.findByLinkedUser(actor.id);
    if (!associate) {
      throw new AuthorizationError('Associate not found for current user');
    }
    associateIds = [associate.id];
  }

  // Build rows for each associate
  const rows = await Promise.all(
    associateIds.map(async (associateId) => {
      const [associate, contributions, distributions, installments] = await Promise.all([
        associateRepository.findById(associateId),
        associateRepository.listContributionsByAssociate(associateId),
        associateRepository.listProfitDistributionsByAssociate(associateId),
        associateRepository.findInstallmentsByAssociateId(associateId),
      ]);

      const totalContributed = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const totalDistributed = distributions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const totalInterestPaid = installments
        .filter((installment) => installment.status === 'paid')
        .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
      const interestDebt = installments
        .filter((installment) => installment.status === 'pending')
        .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
      const nextInterestPayment = installments
        .filter((installment) => installment.status === 'pending')
        .map((installment) => ({ installment, dueDate: toOperationalDateOrNull(installment.dueDate) }))
        .filter((entry) => entry.dueDate)
        .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())[0]?.installment || null;
      const baseFields = {
        interestType: associate.interestType === 'annual' ? 'Anual' : 'Mensual',
        interestRate: associate.interestRate || '0.0000',
        interestDebt: formatMoney(interestDebt),
        totalInterestPaid: formatMoney(totalInterestPaid),
        nextInterestPaymentDate: formatIsoDate(nextInterestPayment?.dueDate),
      };

      // Contribution rows
      const contributionRows = contributions.map((c) => ({
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: ASSOCIATE_EXPORT_SECTIONS.contribution,
        entryId: c.id,
        reference: '',
        amount: formatMoney(c.amount),
        date: formatIsoDate(c.contributionDate),
        status: c.status || 'N/A',
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: c.notes || '',
      }));

      // Distribution rows
      const distributionRows = distributions.map((d) => {
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
          status: d.status || 'N/A',
          participationPercentage: normalized.participationPercentage || normalizeParticipationPercentage(associate.participationPercentage),
          distributionType: normalized.distributionType || 'N/A',
          declaredProportionalTotal: normalized.declaredProportionalTotal || 'N/A',
          allocatedAmount: normalized.allocatedAmount || 'N/A',
          notes: d.notes || '',
        };
      });

      const interestRows = installments.map((installment) => ({
        associateId: associate.id,
        associateName: associate.name,
        ...baseFields,
        section: installment.status === 'paid' ? ASSOCIATE_EXPORT_SECTIONS.interestPaid : ASSOCIATE_EXPORT_SECTIONS.interestDue,
        entryId: installment.id,
        reference: installment.installmentNumber || '',
        amount: formatMoney(installment.amount),
        date: formatIsoDate(installment.status === 'paid' ? installment.paidAt : installment.dueDate),
        status: installment.status === 'paid' ? 'Pagado' : 'Pendiente',
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        distributionType: associate.interestType === 'annual' ? 'Interés anual' : 'Interés mensual',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: installment.notes || '',
      }));

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
        status: associate.status || 'N/A',
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: `Aportes: ${contributions.length}, Distribuciones: ${distributions.length}, Cuotas de interés: ${installments.length}`,
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

module.exports = { createExportAssociatesExcel };
