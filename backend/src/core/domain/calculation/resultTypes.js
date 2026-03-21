const createDagExecutionResult = (scope = {}, executionOrder = [], metrics = {}) => ({
  result: scope,
  scope,
  executionOrder,
  metrics: {
    executionTimeMs: metrics.executionTimeMs || 0,
    nodeCount: metrics.nodeCount || 0,
    edgeCount: metrics.edgeCount || 0,
    timestamp: metrics.timestamp || new Date().toISOString(),
  },
});

const createAmortizationBreakdown = (capital, interest, penalty, fees) => ({
  capital,
  interest,
  penalty,
  fees,
  totalPayment: capital + interest + penalty + fees,
  currency: 'USD',
});

const createCalculationError = (errorType, message, nodeId = null) => ({
  error: {
    type: errorType,
    message,
    nodeId,
    timestamp: new Date().toISOString(),
  },
  ok: false,
});

module.exports = {
  createDagExecutionResult,
  createAmortizationBreakdown,
  createCalculationError,
};