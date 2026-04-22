/**
 * Calculation Adapter — the single entry point for credit simulation numbers.
 *
 * DAG is the single source of truth. There is no legacy fallback.
 *
 * Depending on `dagConfig.mode`:
 *   off     — legacy only (simulateCredit) — EXPLICIT opt-out
 *   shadow  — run both, return DAG, log parity for observability
 *   primary — run persisted graph via graphExecutor, always return DAG
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
    // DAG is the single source of truth. Always execute graph and return DAG result.
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

    comparisonLogger('credits.dag.comparison', {
      mode: dagConfig.mode,
      inputsFingerprint: fingerprint,
      parityPassed: parity.passed,
      mismatchCount: parity.mismatches.length,
      graphVersionId: execution.graphVersionId,
    });

    return {
      mode: dagConfig.mode,
      selectedSource: 'dag',
      result: dagResult,
      parity,
      fallbackReason: null,
      graphVersionId: execution.graphVersionId,
      legacyResult,
      dagResult,
    };
  },
});

module.exports = {
  createCreditsCalculationService,
  createInputsFingerprint,
};
