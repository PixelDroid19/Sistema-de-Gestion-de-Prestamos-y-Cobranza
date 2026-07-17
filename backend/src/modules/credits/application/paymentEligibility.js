const { roundCurrency } = require('./creditFormulaHelpers');
const { BusinessRuleViolationError } = require('@/utils/errorHandler');
const { normalizeDateOnly } = require('@/modules/shared/dateUtils');

const PAYABLE_LOAN_STATUSES = new Set(['pending', 'approved', 'active', 'defaulted', 'overdue']);

const PAYMENT_DENIAL_CODES = Object.freeze({
  OVERDUE_UNPAID_INSTALLMENTS: 'OVERDUE_UNPAID_INSTALLMENTS',
  LOAN_ALREADY_PAID: 'LOAN_ALREADY_PAID',
  FINANCIAL_BLOCK: 'FINANCIAL_BLOCK',
  NO_OUTSTANDING_BALANCE: 'NO_OUTSTANDING_BALANCE',
  LOAN_NOT_PAYABLE_STATUS: 'LOAN_NOT_PAYABLE_STATUS',
  PAYOFF_BEFORE_LOAN_START: 'PAYOFF_BEFORE_LOAN_START',
  FIRST_INSTALLMENT_PAYMENT_REQUIRED: 'FIRST_INSTALLMENT_PAYMENT_REQUIRED',
  CURRENT_INSTALLMENT_PAYMENT_REQUIRED: 'CURRENT_INSTALLMENT_PAYMENT_REQUIRED',
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
    message: source.message ? String(source.message) : 'El crédito tiene un bloqueo financiero activo',
    reason: source.reason ? String(source.reason) : null,
  };
};

const getInstallmentOutstanding = (row = {}) => roundCurrency(
  Number(row.remainingPrincipal || 0) + Number(row.remainingInterest || 0),
);

const isOpenInstallment = (row = {}) => (
  String(row.status || '').toLowerCase() !== 'annulled'
  && getInstallmentOutstanding(row) > 0.01
);

const hasOverdueUnpaidInstallments = ({ schedule = [], asOfDate = new Date() }) => {
  const normalizedAsOfDate = normalizeDateOnly(asOfDate, 'asOfDate');

  return schedule.some((row) => (
    isOpenInstallment(row)
    && normalizeDateOnly(row.dueDate, 'Schedule due date').getTime() < normalizedAsOfDate.getTime()
  ));
};

const findCurrentUnpaidInstallment = ({ schedule = [], asOfDate = new Date() }) => {
  const normalizedAsOfDate = normalizeDateOnly(asOfDate, 'asOfDate');

  return schedule.find((row) => (
    isOpenInstallment(row)
    && normalizeDateOnly(row.dueDate, 'Schedule due date').getTime() === normalizedAsOfDate.getTime()
  )) || null;
};

const resolveLoanStartDate = (loan = {}) => {
  const rawStartDate = loan.startDate
    || loan.financialSnapshot?.startDate
    || loan.createdAt
    || loan.updatedAt;
  const startDate = rawStartDate ? new Date(rawStartDate) : null;

  return startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;
};

const buildFinancialBlockReason = (financialBlock) => ({
  code: PAYMENT_DENIAL_CODES.FINANCIAL_BLOCK,
  message: financialBlock.message || 'El crédito tiene un bloqueo financiero activo',
  ...(financialBlock.code ? { blockCode: financialBlock.code } : {}),
  ...(financialBlock.reason ? { blockReason: financialBlock.reason } : {}),
});

const isPaidInstallment = (row = {}) => (
  String(row.status || '').toLowerCase() === 'paid'
  || (Number(row.paidTotal || 0) > 0.01 && getInstallmentOutstanding(row) <= 0.01)
);

const hasFirstInstallmentPaid = (schedule = []) => {
  const payableRows = schedule
    .filter((row) => String(row?.status || '').toLowerCase() !== 'annulled')
    .sort((left, right) => Number(left?.installmentNumber || 0) - Number(right?.installmentNumber || 0));

  const firstInstallment = payableRows.find((row) => Number(row?.installmentNumber) === 1) || payableRows[0];
  return Boolean(firstInstallment && isPaidInstallment(firstInstallment));
};

const evaluatePayoffEligibility = ({ loan, schedule = [], snapshot = {}, asOfDate = new Date() }) => {
  const denialReasons = [];
  const outstandingBalance = buildOutstandingBalance(snapshot);
  const financialBlock = normalizeFinancialBlock(loan);
  const normalizedAsOfDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const loanStartDate = resolveLoanStartDate(loan);

  if (loan.status === 'closed' || loan.status === 'paid' || outstandingBalance <= 0.01) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.LOAN_ALREADY_PAID,
      message: 'El crédito ya está pagado en su totalidad',
    });
  }
  else if (!PAYABLE_LOAN_STATUSES.has(loan.status)) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.LOAN_NOT_PAYABLE_STATUS,
      message: 'El estado del crédito no permite pago total',
    });
  }

  if (
    loanStartDate
    && !Number.isNaN(normalizedAsOfDate.getTime())
    && normalizedAsOfDate.getTime() < loanStartDate.getTime()
  ) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.PAYOFF_BEFORE_LOAN_START,
      message: 'La fecha efectiva del pago total debe ser igual o posterior al inicio del crédito',
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
  const currentUnpaidInstallment = findCurrentUnpaidInstallment({ schedule, asOfDate });

  if (!PAYABLE_LOAN_STATUSES.has(loan.status)) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.LOAN_NOT_PAYABLE_STATUS,
      message: 'El estado del crédito no permite abonos a capital',
    });
  }

  if (outstandingBalance <= 0.01 || outstandingPrincipal <= 0.01) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.NO_OUTSTANDING_BALANCE,
      message: 'El crédito no tiene saldo pendiente para abono a capital',
    });
  }

  if (outstandingBalance > 0.01 && outstandingPrincipal > 0.01 && currentUnpaidInstallment) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.CURRENT_INSTALLMENT_PAYMENT_REQUIRED,
      message: `Primero paga completamente la cuota vigente #${currentUnpaidInstallment.installmentNumber} antes de abonar a capital`,
      installmentNumber: currentUnpaidInstallment.installmentNumber,
    });
  }
  else if (outstandingBalance > 0.01 && outstandingPrincipal > 0.01 && !hasFirstInstallmentPaid(schedule)) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.FIRST_INSTALLMENT_PAYMENT_REQUIRED,
      message: 'Debe existir al menos la primera cuota pagada antes de abonar a capital',
    });
  }

  if (hasOverdueUnpaidInstallments({ schedule, asOfDate })) {
    denialReasons.push({
      code: PAYMENT_DENIAL_CODES.OVERDUE_UNPAID_INSTALLMENTS,
      message: 'El crédito tiene cuotas vencidas pendientes',
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
    throw new BusinessRuleViolationError('El pago total no está permitido para este crédito', {
      code: 'PAYOFF_NOT_ALLOWED',
      denialReasons: eligibility.denialReasons,
    });
  }
};

const assertCapitalPaymentAllowed = (input) => {
  const eligibility = evaluateCapitalPaymentEligibility(input);
  if (!eligibility.allowed) {
    throw new BusinessRuleViolationError('El abono a capital no está permitido para este crédito', {
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
  resolveLoanStartDate,
};
