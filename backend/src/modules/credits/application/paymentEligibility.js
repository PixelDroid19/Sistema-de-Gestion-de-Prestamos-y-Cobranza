const { roundCurrency } = require('./creditFormulaHelpers');
const { BusinessRuleViolationError } = require('@/utils/errorHandler');

const PAYABLE_LOAN_STATUSES = new Set(['approved', 'active', 'defaulted', 'overdue']);

const PAYMENT_DENIAL_CODES = Object.freeze({
  OVERDUE_UNPAID_INSTALLMENTS: 'OVERDUE_UNPAID_INSTALLMENTS',
  LOAN_ALREADY_PAID: 'LOAN_ALREADY_PAID',
  FINANCIAL_BLOCK: 'FINANCIAL_BLOCK',
  NO_OUTSTANDING_BALANCE: 'NO_OUTSTANDING_BALANCE',
  LOAN_NOT_PAYABLE_STATUS: 'LOAN_NOT_PAYABLE_STATUS',
});

const buildOutstandingBalance = (snapshot = {}) => roundCurrency(
  Number(snapshot.outstandingBalance || 0),
);

const buildOutstandingPrincipal = ({ snapshot = {}, loan = {} }) => roundCurrency(
  Number(snapshot.outstandingPrincipal ?? loan.principalOutstanding ?? 0),
);

const normalizeFinancialBlock = (loan = {}) => {
  const source = loan.financialBlock ?? loan.financialSnapshot?.financialBlock ?? null;

  if (!source || typeof source !== 'object') {
    return {
      isBlocked: false,
      code: null,
      message: null,
      reason: null,
    };
  }

  return {
    isBlocked: source.isBlocked === true || source.active === true,
    code: source.code ? String(source.code) : null,
    message: source.message ? String(source.message) : 'Loan has an active financial block',
    reason: source.reason ? String(source.reason) : null,
  };
};

const hasOverdueUnpaidInstallments = ({ schedule = [], asOfDate = new Date() }) => {
  const normalizedAsOfDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);

  return schedule.some((row) => {
    const outstanding = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
    return outstanding > 0.01
      && row.status !== 'annulled'
      && new Date(row.dueDate).getTime() < normalizedAsOfDate.getTime();
  });
};

const buildFinancialBlockReason = (financialBlock) => ({
  code: PAYMENT_DENIAL_CODES.FINANCIAL_BLOCK,
  message: financialBlock.message || 'Loan has an active financial block',
  ...(financialBlock.code ? { blockCode: financialBlock.code } : {}),
  ...(financialBlock.reason ? { blockReason: financialBlock.reason } : {}),
});

const evaluatePayoffEligibility = ({ loan, schedule = [], snapshot = {}, asOfDate = new Date() }) => {
  const denialReasons = [];
  const outstandingBalance = buildOutstandingBalance(snapshot);
  const financialBlock = normalizeFinancialBlock(loan);

  if (loan.status === 'closed' || loan.status === 'paid' || outstandingBalance <= 0.01) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.LOAN_ALREADY_PAID,
      message: 'Loan is already fully paid',
    });
  }
  else if (!PAYABLE_LOAN_STATUSES.has(loan.status)) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.LOAN_NOT_PAYABLE_STATUS,
      message: `Loan status ${loan.status} does not allow total payoff`,
    });
  }

  if (hasOverdueUnpaidInstallments({ schedule, asOfDate })) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.OVERDUE_UNPAID_INSTALLMENTS,
      message: 'Loan has overdue unpaid installments',
    });
  }

  if (financialBlock.isBlocked) {
    denialReasons.push(buildFinancialBlockReason(financialBlock));
  }

  return {
    allowed: denialReasons.length === 0,
    denialReasons,
  };
};

const evaluateCapitalPaymentEligibility = ({ loan, schedule = [], snapshot = {}, asOfDate = new Date() }) => {
  const denialReasons = [];
  const outstandingBalance = buildOutstandingBalance(snapshot);
  const outstandingPrincipal = buildOutstandingPrincipal({ snapshot, loan });
  const financialBlock = normalizeFinancialBlock(loan);

  if (!PAYABLE_LOAN_STATUSES.has(loan.status)) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.LOAN_NOT_PAYABLE_STATUS,
      message: `Loan status ${loan.status} does not allow capital payments`,
    });
  }

  if (outstandingBalance <= 0.01 || outstandingPrincipal <= 0.01) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.NO_OUTSTANDING_BALANCE,
      message: 'Loan has no outstanding balance for capital payment',
    });
  }

  if (hasOverdueUnpaidInstallments({ schedule, asOfDate })) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.OVERDUE_UNPAID_INSTALLMENTS,
      message: 'Loan has overdue unpaid installments',
    });
  }

  if (financialBlock.isBlocked) {
    denialReasons.push(buildFinancialBlockReason(financialBlock));
  }

  return {
    allowed: denialReasons.length === 0,
    denialReasons,
  };
};

const assertPayoffAllowed = (input) => {
  const eligibility = evaluatePayoffEligibility(input);
  if (!eligibility.allowed) {
    throw new BusinessRuleViolationError('Total payoff is not allowed for this loan', {
      code: 'PAYOFF_NOT_ALLOWED',
      denialReasons: eligibility.denialReasons,
    });
  }
};

const assertCapitalPaymentAllowed = (input) => {
  const eligibility = evaluateCapitalPaymentEligibility(input);
  if (!eligibility.allowed) {
    throw new BusinessRuleViolationError('Capital payment is not allowed for this loan', {
      code: 'CAPITAL_PAYMENT_NOT_ALLOWED',
      denialReasons: eligibility.denialReasons,
    });
  }
};

module.exports = {
  PAYABLE_LOAN_STATUSES,
  PAYMENT_DENIAL_CODES,
  assertCapitalPaymentAllowed,
  assertPayoffAllowed,
  evaluateCapitalPaymentEligibility,
  evaluatePayoffEligibility,
  hasOverdueUnpaidInstallments,
  normalizeFinancialBlock,
};
