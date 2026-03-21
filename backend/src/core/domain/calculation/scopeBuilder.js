const BigNumberEngine = require('./BigNumberEngine');

const buildInitialScope = (contractVars = {}) => {
  const engine = BigNumberEngine.getInstance();
  const scope = {};

  const varNames = [
    'principal',
    'interestRate',
    'paymentAmount',
    'term',
    'balance',
    'capital',
    'interest',
    'penalty',
    'fees',
  ];

  for (const [key, value] of Object.entries(contractVars)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'number') {
      scope[key] = engine._getMathInstance().bignumber(value);
    } else if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        scope[key] = engine._getMathInstance().bignumber(parsed);
      } else {
        scope[key] = value;
      }
    } else {
      scope[key] = value;
    }
  }

  return scope;
};

const createAmortizationScope = (principal, rate, term, paymentAmount) => {
  return buildInitialScope({
    principal,
    interestRate: rate,
    term,
    paymentAmount,
    balance: principal,
  });
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

const scopeToNumbers = (scope) => {
  if (!scope || typeof scope !== 'object') {
    return scope;
  }

  const result = {};

  for (const [key, value] of Object.entries(scope)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    if (typeof value === 'object' && value.isBigNumber === true) {
      result[key] = parseFloat(value.toString());
    } else if (typeof value === 'object' && value.constructor && value.constructor.name === 'BigNumber') {
      result[key] = parseFloat(value.toString());
    } else if (typeof value === 'object') {
      result[key] = scopeToNumbers(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};

module.exports = {
  buildInitialScope,
  createAmortizationScope,
  scopeToPlainObject,
  scopeToNumbers,
};