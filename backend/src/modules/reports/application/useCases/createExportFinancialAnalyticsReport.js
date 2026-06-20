const { ensureAdmin, buildPdfBuffer, formatDisplayMoney } = require('@/modules/reports/application/reportHelpers');
const { STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const { MONEY_FORMAT, parseExcelMoney } = require('@/modules/reports/application/excelExportFormats');
const { ValidationError } = require('@/utils/errorHandler');

const PERCENT_FORMAT = '0.00%';
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const hasPercent = trimmed.includes('%');
    const normalized = trimmed.replace(/[^\d,.-]/g, '');
    const dotted = normalized.includes(',') && !normalized.includes('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
    const parsed = Number(dotted);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return hasPercent ? parsed / 100 : parsed;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatReportMoney = (value) => {
  const text = String(value ?? '').trim();
  if (text.startsWith('COP ')) {
    return text;
  }
  return formatDisplayMoney(parseExcelMoney(value));
};

const toPercentDecimal = (value) => toNumber(value) / 100;

const getTrendLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'up') return 'Al alza';
  if (key === 'down') return 'A la baja';
  return 'Estable';
};

const getConfidenceLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'high') return 'Alta';
  if (key === 'medium') return 'Media';
  if (key === 'historical') return 'Histórica';
  return 'Baja';
};

const deriveNextMonthLabel = (value, targetYear) => {
  const normalized = String(value || '').trim();
  const match = MONTH_PATTERN.exec(normalized);
  if (!match) {
    return `${targetYear}-01`;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return `${targetYear}-01`;
  }

  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const buildSummaryRows = ({
  targetYear,
  summary,
  yearOverYear,
  forecast,
  projectionSnapshot,
}) => ([
  {
    indicator: 'Año analizado',
    value: targetYear,
    detail: 'Periodo usado para consolidar tendencias, comparativos y proyecciones.',
  },
  {
    indicator: 'Ingresos del año',
    value: toNumber(summary.totalEarnings),
    detail: 'Capital recuperado, interés y mora del periodo.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Intereses cobrados',
    value: toNumber(summary.totalInterest),
    detail: 'Interés real cobrado a la cartera.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Mora cobrada',
    value: toNumber(summary.totalPenalties),
    detail: 'Recuperación por penalidades o cargos por atraso.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Pagos registrados',
    value: Number(summary.paymentCount || 0),
    detail: 'Cantidad de movimientos incluidos en la analítica.',
  },
  {
    indicator: 'Créditos evaluados',
    value: Number(summary.totalLoans || 0),
    detail: 'Créditos que aportan al cálculo del periodo.',
  },
  {
    indicator: 'Capital desembolsado',
    value: toNumber(summary.totalLoanAmount),
    detail: 'Monto total prestado durante el periodo analizado.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Cambio anual de ingresos',
    value: toPercentDecimal(yearOverYear.earningsChange),
    detail: 'Variación frente al año inmediatamente anterior.',
    __formats: { value: { numFmt: PERCENT_FORMAT } },
  },
  {
    indicator: 'Promedio móvil actual',
    value: toNumber(forecast.analysis?.currentMovingAverage),
    detail: 'Promedio móvil de la serie mensual del año.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Proyección del siguiente periodo',
    value: toNumber(projectionSnapshot.projectedEarnings),
    detail: `Periodo estimado: ${projectionSnapshot.projectedMonth}`,
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
]);

const buildComparisonRows = (comparison = {}) => {
  const metrics = [
    ['Ingresos', comparison.earnings, 'currency'],
    ['Intereses', comparison.interest, 'currency'],
    ['Mora', comparison.penalties, 'currency'],
    ['Pagos', comparison.payments, 'count'],
    ['Créditos', comparison.loans, 'count'],
    ['Capital desembolsado', comparison.loanAmount, 'currency'],
  ];

  return metrics.map(([metric, values, kind]) => {
    const row = {
      metric,
      current: kind === 'count' ? Number(values?.current || 0) : toNumber(values?.current),
      previous: kind === 'count' ? Number(values?.previous || 0) : toNumber(values?.previous),
      changePercent: toPercentDecimal(values?.changePercent),
    };

    if (kind === 'currency') {
      row.__formats = {
        current: { numFmt: MONEY_FORMAT },
        previous: { numFmt: MONEY_FORMAT },
        changePercent: { numFmt: PERCENT_FORMAT },
      };
      return row;
    }

    row.__formats = {
      changePercent: { numFmt: PERCENT_FORMAT },
    };
    return row;
  });
};

const buildMonthlyRows = (monthlyDetails = []) => monthlyDetails.map((row) => ({
  month: row.month || '',
  earnings: toNumber(row.totalEarnings),
  interest: toNumber(row.totalInterest),
  penalties: toNumber(row.totalPenalties),
  movingAverage: toNumber(row.movingAverage),
  changePercent: toPercentDecimal(row.changePercent),
  trend: getTrendLabel(row.trend),
  __formats: {
    earnings: { numFmt: MONEY_FORMAT },
    interest: { numFmt: MONEY_FORMAT },
    penalties: { numFmt: MONEY_FORMAT },
    movingAverage: { numFmt: MONEY_FORMAT },
    changePercent: { numFmt: PERCENT_FORMAT },
  },
}));

const buildProjectionRows = (projectionSnapshot) => ([
  {
    indicator: 'Periodo proyectado',
    value: projectionSnapshot.projectedMonth,
    detail: 'Siguiente periodo estimado por la serie histórica.',
  },
  {
    indicator: 'Ingreso proyectado',
    value: toNumber(projectionSnapshot.projectedEarnings),
    detail: `Base histórica de ${projectionSnapshot.basedOnMonths} meses.`,
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Promedio de referencia',
    value: toNumber(projectionSnapshot.averageEarnings),
    detail: 'Promedio simple de la base utilizada para la proyección.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Último periodo observado',
    value: toNumber(projectionSnapshot.lastMonthEarnings),
    detail: 'Último dato usado como referencia en la serie.',
    __formats: { value: { numFmt: MONEY_FORMAT } },
  },
  {
    indicator: 'Tendencia',
    value: getTrendLabel(projectionSnapshot.trend),
    detail: 'Dirección general observada en la serie analítica.',
  },
  {
    indicator: 'Confianza',
    value: getConfidenceLabel(projectionSnapshot.confidenceLevel),
    detail: 'Nivel de confianza operativo de la proyección.',
  },
]);

const buildAnalyticsSheets = ({
  targetYear,
  comprehensive,
  comparative,
  projectionSnapshot,
}) => ([
  {
    name: 'Resumen',
    title: `ANALITICA FINANCIERA ${targetYear}`,
    tabColor: STYLE_COLORS.blue,
    headerFill: STYLE_COLORS.headerBlue,
    columns: [
      { header: 'Indicador', key: 'indicator', width: 28 },
      { header: 'Valor', key: 'value', width: 20 },
      { header: 'Detalle', key: 'detail', width: 52 },
    ],
    rows: buildSummaryRows({
      targetYear,
      summary: comprehensive.summary || {},
      yearOverYear: comprehensive.yearOverYear || {},
      forecast: projectionSnapshot.forecastData || {},
      projectionSnapshot,
    }),
  },
  {
    name: 'Comparativo',
    title: `COMPARATIVO ANUAL ${targetYear}`,
    tabColor: STYLE_COLORS.green,
    headerFill: STYLE_COLORS.headerBlue,
    columns: [
      { header: 'Métrica', key: 'metric', width: 24 },
      { header: 'Año actual', key: 'current', width: 18 },
      { header: 'Año previo', key: 'previous', width: 18 },
      { header: 'Variación', key: 'changePercent', width: 16 },
    ],
    rows: buildComparisonRows(comparative.comparison || {}),
  },
  {
    name: 'Tendencia mensual',
    title: `TENDENCIA MENSUAL ${targetYear}`,
    tabColor: STYLE_COLORS.teal,
    headerFill: STYLE_COLORS.headerBlue,
    columns: [
      { header: 'Mes', key: 'month', width: 14 },
      { header: 'Ingresos', key: 'earnings', width: 18, numFmt: MONEY_FORMAT },
      { header: 'Intereses', key: 'interest', width: 18, numFmt: MONEY_FORMAT },
      { header: 'Mora', key: 'penalties', width: 18, numFmt: MONEY_FORMAT },
      { header: 'Promedio móvil', key: 'movingAverage', width: 18, numFmt: MONEY_FORMAT },
      { header: 'Variación', key: 'changePercent', width: 16, numFmt: PERCENT_FORMAT },
      { header: 'Tendencia', key: 'trend', width: 16 },
    ],
    rows: buildMonthlyRows(comprehensive.monthlyDetails || []),
  },
  {
    name: 'Proyeccion',
    title: `PROYECCION ${targetYear}`,
    tabColor: STYLE_COLORS.purple,
    headerFill: STYLE_COLORS.headerBlue,
    columns: [
      { header: 'Indicador', key: 'indicator', width: 28 },
      { header: 'Valor', key: 'value', width: 20 },
      { header: 'Detalle', key: 'detail', width: 52 },
    ],
    rows: buildProjectionRows(projectionSnapshot),
  },
]);

const buildAnalyticsPdf = ({
  targetYear,
  comprehensive,
  comparative,
  projectionSnapshot,
}) => {
  const summary = comprehensive.summary || {};
  const comparison = comparative.comparison || {};
  const monthlyRows = Array.isArray(comprehensive.monthlyDetails)
    ? comprehensive.monthlyDetails.slice(0, 12)
    : [];

  const lines = [
    `Año analizado: ${targetYear}`,
    `Ingresos del año: ${formatReportMoney(summary.totalEarnings)}`,
    `Intereses cobrados: ${formatReportMoney(summary.totalInterest)}`,
    `Mora cobrada: ${formatReportMoney(summary.totalPenalties)}`,
    `Pagos registrados: ${summary.paymentCount || 0}`,
    `Créditos evaluados: ${summary.totalLoans || 0}`,
    `Capital desembolsado: ${formatReportMoney(summary.totalLoanAmount)}`,
    '',
    'Comparativo anual:',
    `Ingresos: ${formatReportMoney(comparison.earnings?.current)} vs ${formatReportMoney(comparison.earnings?.previous)} (${comparison.earnings?.changePercent || 0}%)`,
    `Intereses: ${formatReportMoney(comparison.interest?.current)} vs ${formatReportMoney(comparison.interest?.previous)} (${comparison.interest?.changePercent || 0}%)`,
    `Mora: ${formatReportMoney(comparison.penalties?.current)} vs ${formatReportMoney(comparison.penalties?.previous)} (${comparison.penalties?.changePercent || 0}%)`,
    `Pagos: ${comparison.payments?.current || 0} vs ${comparison.payments?.previous || 0}`,
    '',
    'Proyección:',
    `Periodo estimado: ${projectionSnapshot.projectedMonth}`,
    `Ingreso proyectado: ${formatReportMoney(projectionSnapshot.projectedEarnings)}`,
    `Promedio de referencia: ${formatReportMoney(projectionSnapshot.averageEarnings)}`,
    `Último periodo observado: ${formatReportMoney(projectionSnapshot.lastMonthEarnings)}`,
    `Tendencia: ${getTrendLabel(projectionSnapshot.trend)}`,
    `Confianza: ${getConfidenceLabel(projectionSnapshot.confidenceLevel)}`,
    '',
    'Tendencia mensual:',
    ...monthlyRows.map((row) => (
      `${row.month}: ingresos ${formatReportMoney(row.totalEarnings)} · intereses ${formatReportMoney(row.totalInterest)} · mora ${formatReportMoney(row.totalPenalties)}`
    )),
  ].slice(0, 42);

  return buildPdfBuffer({
    title: `Analítica financiera ${targetYear}`,
    lines,
  });
};

const createExportFinancialAnalyticsReport = ({
  getComprehensiveAnalytics,
  getComparativeAnalysis,
  getForecastAnalysis,
  getNextMonthProjection,
}) => async ({ actor, year, format = 'xlsx' }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden exportar reportes de analítica financiera.');

  const normalizedFormat = String(format || 'xlsx').trim().toLowerCase();
  if (!['xlsx', 'excel', 'pdf'].includes(normalizedFormat)) {
    throw new ValidationError('El formato de la analítica financiera debe ser Excel o PDF.');
  }

  const targetYear = Number.isFinite(Number(year)) ? Number(year) : new Date().getFullYear();
  const [comprehensiveResult, comparativeResult, forecastResult, currentProjectionResult] = await Promise.all([
    getComprehensiveAnalytics({ actor, year: targetYear }),
    getComparativeAnalysis({ actor, year: targetYear }),
    getForecastAnalysis({ actor, year: targetYear }),
    targetYear === new Date().getFullYear()
      ? getNextMonthProjection({ actor })
      : Promise.resolve(null),
  ]);

  const comprehensive = comprehensiveResult?.data || {};
  const comparative = comparativeResult?.data || {};
  const forecast = forecastResult?.data || {};
  const monthlyDetails = Array.isArray(comprehensive.monthlyDetails)
    ? comprehensive.monthlyDetails
    : [];
  const historicalData = Array.isArray(forecast.historicalData)
    ? forecast.historicalData
    : [];
  const lastKnownMonth = historicalData[historicalData.length - 1]?.month
    || monthlyDetails[monthlyDetails.length - 1]?.month;

  const projectionSnapshot = currentProjectionResult?.data?.projection
    ? {
      projectedMonth: currentProjectionResult.data.projection.month,
      projectedEarnings: currentProjectionResult.data.projection.projectedEarnings,
      confidenceLevel: currentProjectionResult.data.projection.confidenceLevel,
      basedOnMonths: currentProjectionResult.data.projection.basedOnMonths,
      averageEarnings: currentProjectionResult.data.historicalSummary?.averageEarnings || '0.00',
      lastMonthEarnings: currentProjectionResult.data.historicalSummary?.lastMonthEarnings || '0.00',
      trend: forecast.analysis?.trend || 'stable',
      forecastData: forecast,
    }
    : {
      projectedMonth: deriveNextMonthLabel(lastKnownMonth, targetYear),
      projectedEarnings: forecast.forecast?.nextMonthEarnings || '0.00',
      confidenceLevel: historicalData.length >= 3 ? 'historical' : 'low',
      basedOnMonths: historicalData.length,
      averageEarnings: historicalData.length > 0
        ? (
          historicalData.reduce((sum, row) => sum + toNumber(row.earnings), 0) / historicalData.length
        ).toFixed(2)
        : '0.00',
      lastMonthEarnings: historicalData[historicalData.length - 1]?.earnings || '0.00',
      trend: forecast.analysis?.trend || 'stable',
      forecastData: forecast,
    };

  if (normalizedFormat === 'pdf') {
    return {
      fileName: `analitica-financiera-${targetYear}.pdf`,
      contentType: 'application/pdf',
      buffer: buildAnalyticsPdf({
        targetYear,
        comprehensive,
        comparative,
        projectionSnapshot,
      }),
    };
  }

  return {
    fileName: `analitica-financiera-${targetYear}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: buildAnalyticsSheets({
      targetYear,
      comprehensive,
      comparative,
      projectionSnapshot,
    }),
  };
};

module.exports = {
  createExportFinancialAnalyticsReport,
};
