/**
 * Consolidated financial analytics use case.
 *
 * The Analytics tab previously fanned out to six separate endpoints
 * (performance-analysis, executive-dashboard, comprehensive-analytics,
 * comparative-analysis, forecast-analysis, next-month-projection) which
 * overlapped heavily and forced the client to reconcile their shapes with
 * `??` fallbacks. This composes the existing, individually-tested use cases
 * server-side and returns them as a single bundle in one round-trip.
 *
 * It intentionally reuses the same composed functions wired in index.js so the
 * per-endpoint contracts stay identical; only the transport is consolidated.
 */
const createGetFinancialAnalytics = ({
  getPerformanceAnalysis,
  getExecutiveDashboard,
  getComprehensiveAnalytics,
  getComparativeAnalysis,
  getForecastAnalysis,
  getNextMonthProjection,
}) => async ({ actor, year }) => {
  const [
    performanceAnalysis,
    executiveDashboard,
    comprehensiveAnalytics,
    comparativeAnalysis,
    forecastAnalysis,
    nextMonthProjection,
  ] = await Promise.all([
    getPerformanceAnalysis({ actor, year }),
    getExecutiveDashboard({ actor }),
    getComprehensiveAnalytics({ actor, year }),
    getComparativeAnalysis({ actor, year }),
    getForecastAnalysis({ actor, year }),
    getNextMonthProjection({ actor }),
  ]);

  return {
    success: true,
    data: {
      year: year || new Date().getFullYear(),
      performanceAnalysis,
      executiveDashboard,
      comprehensiveAnalytics,
      comparativeAnalysis,
      forecastAnalysis,
      nextMonthProjection,
    },
  };
};

module.exports = { createGetFinancialAnalytics };
