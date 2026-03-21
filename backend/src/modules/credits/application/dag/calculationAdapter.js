const crypto = require('node:crypto');

const { simulateCredit } = require('../creditSimulationService');
const { compareSimulationResults } = require('./parity');
const { createSimulationDagExecutor } = require('./simulationGraph');
const { createCreditsDagConfig } = require('./config');

const createInputsFingerprint = (input) => crypto
  .createHash('sha1')
  .update(JSON.stringify(input || {}))
  .digest('hex')
  .slice(0, 12);

const createCreditsCalculationService = ({
  dagConfig = createCreditsDagConfig(),
  legacySimulator = simulateCredit,
  dagExecutor = createSimulationDagExecutor(),
  comparisonLogger = () => {},
} = {}) => ({
  calculate(input) {
    const fingerprint = createInputsFingerprint(input);
    const legacyResult = legacySimulator(input);

    if (dagConfig.mode === 'off') {
      return {
        mode: dagConfig.mode,
        selectedSource: 'legacy',
        result: legacyResult,
        parity: null,
        fallbackReason: null,
      };
    }

    try {
      const dagExecution = dagExecutor(input);
      const dagResult = dagExecution.outputs.result;
      const parity = compareSimulationResults({
        legacyResult,
        dagResult,
        tolerance: dagConfig.parityTolerance,
      });

      const selectedSource = dagConfig.mode === 'primary' && parity.passed ? 'dag' : 'legacy';
      const fallbackReason = selectedSource === 'legacy' && dagConfig.mode === 'primary' && !parity.passed
        ? 'parity_mismatch'
        : null;

      comparisonLogger('credits.dag.comparison', {
        mode: dagConfig.mode,
        inputsFingerprint: fingerprint,
        parityPassed: parity.passed,
        mismatchCount: parity.mismatches.length,
        fallbackReason,
      });

      return {
        mode: dagConfig.mode,
        selectedSource,
        result: selectedSource === 'dag' ? dagResult : legacyResult,
        parity,
        fallbackReason,
        legacyResult,
        dagResult,
      };
    } catch (error) {
      comparisonLogger('credits.dag.comparison', {
        mode: dagConfig.mode,
        inputsFingerprint: fingerprint,
        parityPassed: false,
        mismatchCount: 0,
        fallbackReason: 'dag_execution_failed',
        errorMessage: error.message,
      });

      return {
        mode: dagConfig.mode,
        selectedSource: 'legacy',
        result: legacyResult,
        parity: {
          passed: false,
          tolerance: dagConfig.parityTolerance,
          mismatches: [{ scope: 'dag', field: 'execution', expected: 'success', actual: error.message }],
        },
        fallbackReason: 'dag_execution_failed',
        legacyResult,
        dagResult: null,
      };
    }
  },
});

module.exports = {
  createCreditsCalculationService,
  createInputsFingerprint,
};
