const BigNumberEngine = require('./BigNumberEngine');
const {
  calculateLateFee,
  buildAmortizationSchedule,
  summarizeSchedule,
  roundCurrency,
} = require('@/modules/credits/application/creditFormulaHelpers');
const { assertSupportedLateFeeMode } = require('@/modules/credits/application/dag/lateFeeMode');

const isNumericString = (value) => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value).trim());

const buildInitialScope = (contractVars = {}) => {
  const engine = BigNumberEngine.getInstance();
  const scope = {};

  for (const [key, value] of Object.entries(contractVars)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'number') {
      scope[key] = engine._getMathInstance().bignumber(value);
    } else if (typeof value === 'string') {
      if (isNumericString(value)) {
        const parsed = parseFloat(value);
        scope[key] = engine._getMathInstance().bignumber(parsed);
      } else {
        scope[key] = value;
      }
    } else {
      scope[key] = value;
    }
  }

  // Ensure common optional DAG variables have defaults so mathjs formulas
  // can reference them without "Undefined symbol" errors.
  if (!('startDate' in scope)) scope.startDate = null;
  if (!('lateFeeMode' in scope)) scope.lateFeeMode = 'NONE';

  // Add custom formula helpers to scope for DAG formula evaluation.
  // Wrappers accept both object form (from JS callers) and positional args
  // (from mathjs formulas, which cannot construct JS objects).
  scope.calculateLateFee = calculateLateFee;
  scope.buildAmortizationSchedule = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      return buildAmortizationSchedule(args[0]);
    }
    const [a, r, t, sd, lfm] = args;
    return buildAmortizationSchedule({
      amount: typeof a === 'object' && a?.toNumber ? a.toNumber() : Number(a),
      interestRate: typeof r === 'object' && r?.toNumber ? r.toNumber() : Number(r),
      termMonths: typeof t === 'object' && t?.toNumber ? t.toNumber() : Number(t),
      startDate: sd,
      lateFeeMode: lfm,
    });
  };
  scope.summarizeSchedule = summarizeSchedule;
  scope.roundCurrency = roundCurrency;
  scope.assertSupportedLateFeeMode = assertSupportedLateFeeMode;

  /**
   * Build the canonical simulation result object.
   * mathjs cannot construct `{ key: value }` literals, so graph output nodes
   * call this helper with positional args.
   */
  scope.buildSimulationResult = (lfm, sched, summ) => ({
    lateFeeMode: lfm,
    schedule: sched,
    summary: summ,
  });

  // Logical helpers for the visual block-based formula editor.
  // These allow IF/THEN/ELSE, AND, OR, NOT constructions in mathjs formulas.
  scope.ifThenElse = (condition, thenValue, elseValue) => {
    const truthy = condition !== false
      && condition !== 0
      && condition !== null
      && condition !== undefined
      && condition !== '';
    return truthy ? thenValue : elseValue;
  };

  // mathjs already has and/or/not, but we ensure they are available
  // in case the formula engine instance doesn't include them.
  if (!scope.and) {
    scope.and = (...args) => args.every((a) => a !== false && a !== 0 && a !== null && a !== undefined && a !== '');
  }
  if (!scope.or) {
    scope.or = (...args) => args.some((a) => a !== false && a !== 0 && a !== null && a !== undefined && a !== '');
  }
  if (!scope.not) {
    scope.not = (a) => a === false || a === 0 || a === null || a === undefined || a === '';
  }

  return scope;
};

const isBigNumberLike = (value) => {
  if (typeof value !== 'object') return false;
  if (value.isBigNumber === true) return true;
  if (value.isDecimal === true) return true;
  if (value.constructor && (value.constructor.name === 'BigNumber' || value.constructor.name === 'Decimal')) return true;
  return false;
};

const scopeToPlainObject = (scope) => {
  if (!scope || typeof scope !== 'object') {
    return scope;
  }

  if (isBigNumberLike(scope)) {
    return parseFloat(scope.toString());
  }

  // Preserve arrays — convert each element but keep the array shape
  if (Array.isArray(scope)) {
    return scope.map((item) => scopeToPlainObject(item));
  }

  const result = {};

  for (const [key, value] of Object.entries(scope)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    if (isBigNumberLike(value)) {
      result[key] = parseFloat(value.toString());
    } else if (typeof value === 'object') {
      result[key] = scopeToPlainObject(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};

module.exports = {
  buildInitialScope,
  scopeToPlainObject,
};
