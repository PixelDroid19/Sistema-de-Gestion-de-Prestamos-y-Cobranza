/**
 * Calculation Adapter — the single entry point for credit simulation numbers.
 *
 * Depending on `dagConfig.mode`:
 *   off     — legacy only (simulateCredit)
 *   shadow  — run both, return legacy, log parity
 *   primary — run persisted graph via graphExecutor, fallback to legacy on error
 *
 * The adapter is SYNCHRONOUS in `off` mode but ASYNCHRONOUS in `shadow` and
 * `primary` because `graphExecutor.execute` loads the persisted version from DB.
 *
 * Important: every caller that was previously synchronous (e.g. loanCreation)
 * must await the result now when mode !== 'off'.
 */

const crypto = require('node:crypto');

const { simulateCredit } = require('@/modules/credits/application/creditSimulationService');
const { compareSimulationResults } = require('./parity');
const { createCreditsDagConfig } = require('./config');
const { DEFAULT_SCOPE_KEY } = require('./scopeRegistry');

const createInputsFingerprint = (input) => crypto
  .createHash('sha1')
  .update(JSON.stringify(input || {}))
  .digest('hex')
  .slice(0, 12);

const normalizeCalculationInput = (input = {}) => {
  const rawStartDate = input.startDate;

  if (rawStartDate !== undefined && rawStartDate !== null && rawStartDate !== '') {
    const parsedStartDate = new Date(rawStartDate);
    if (!Number.isNaN(parsedStartDate.getTime())) {
      return input;
    }
  }

  return {
    ...input,
    startDate: new Date().toISOString(),
  };
};

/**
 * @param {object} opts
 * @param {object} [opts.dagConfig]
 * @param {Function} [opts.legacySimulator]
 * @param {object} [opts.graphExecutor]       - createGraphExecutor instance (has .execute)
 * @param {string} [opts.scopeKey]
 * @param {Function} [opts.comparisonLogger]
 */
const createCreditsCalculationService = ({
  dagConfig = createCreditsDagConfig(),
  legacySimulator = simulateCredit,
  graphExecutor = null,
  scopeKey = DEFAULT_SCOPE_KEY,
  comparisonLogger = () => {},
} = {}) => ({
  /**
   * Run a credit simulation.
   *
   * @param {object} input - { amount, interestRate, termMonths, lateFeeMode?, startDate? }
   * @returns {Promise<object>} - { mode, selectedSource, result, parity, fallbackReason, graphVersionId? }
   *
   * Note: returns a Promise in all modes so callers have one consistent interface.
   */
  async calculate(input) {
    const normalizedInput = normalizeCalculationInput(input);
    const fingerprint = createInputsFingerprint(normalizedInput);
    const legacyResult = legacySimulator(normalizedInput);

    // ── off ─────────────────────────────────────────────────────────────
    if (dagConfig.mode === 'off' || !graphExecutor) {
      return {
        mode: dagConfig.mode,
        selectedSource: 'legacy',
        result: legacyResult,
        parity: null,
        fallbackReason: graphExecutor ? null : 'no_graph_executor',
        graphVersionId: null,
      };
    }

    // ── shadow / primary ────────────────────────────────────────────────
    try {
        const execution = await graphExecutor.execute({
          scopeKey,
          contractVars: normalizedInput,
        });

      const dagResult = execution.result;
      const parity = compareSimulationResults({
        legacyResult,
        dagResult,
        tolerance: dagConfig.parityTolerance,
      });

      const useDag = dagConfig.mode === 'primary' && parity.passed;
      const selectedSource = useDag ? 'dag' : 'legacy';
      const fallbackReason = !useDag && dagConfig.mode === 'primary' && !parity.passed
        ? 'parity_mismatch'
        : null;

      comparisonLogger('credits.dag.comparison', {
        mode: dagConfig.mode,
        inputsFingerprint: fingerprint,
        parityPassed: parity.passed,
        mismatchCount: parity.mismatches.length,
        fallbackReason,
        graphVersionId: execution.graphVersionId,
      });

      return {
        mode: dagConfig.mode,
        selectedSource,
        result: useDag ? dagResult : legacyResult,
        parity,
        fallbackReason,
        graphVersionId: execution.graphVersionId,
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
        graphVersionId: null,
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
