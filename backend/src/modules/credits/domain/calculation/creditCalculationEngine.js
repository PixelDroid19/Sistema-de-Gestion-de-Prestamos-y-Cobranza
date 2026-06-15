const { ValidationError } = require('@/utils/errorHandler');
const {
  buildAmortizationSchedule,
  summarizeSchedule,
} = require('./amortizationMethods');
const { assertSupportedCalculationMethod } = require('./calculationMethods');
const { assertSupportedLateFeeMode } = require('./lateFeeCalculator');
const { buildCalculationExplanation } = require('./calculationExplainer');
const { buildPolicySnapshot } = require('./policySnapshotBuilder');
const { assertActiveProfile } = require('./calculationProfiles');
const { normalizeDateOnly } = require('@/modules/shared/dateUtils');

const resolveDefaultStartDate = () => normalizeDateOnly(new Date(), 'startDate').toISOString();
const CREDIT_AMOUNT_POSITIVE_MESSAGE = 'El monto del crédito debe ser mayor que 0.';
const CREDIT_INTEREST_RATE_RANGE_MESSAGE = 'La tasa del crédito debe estar entre 0 y 100.';
const CREDIT_TERM_RANGE_MESSAGE = 'El plazo debe ser un número entero entre 1 y 360 meses.';

const normalizeCreditCalculationInput = (input = {}) => {
  const amount = Number(input.amount);
  const interestRate = Number(input.interestRate);
  const normalizedTermMonths = typeof input.termMonths === 'string' ? input.termMonths.trim() : input.termMonths;
  const hasPlainIntegerTerm = typeof normalizedTermMonths === 'string'
    ? /^\d+$/.test(normalizedTermMonths)
    : true;
  const termMonths = Number(normalizedTermMonths);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError(CREDIT_AMOUNT_POSITIVE_MESSAGE);
  }
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
    throw new ValidationError(CREDIT_INTEREST_RATE_RANGE_MESSAGE);
  }
  if (!hasPlainIntegerTerm || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 360) {
    throw new ValidationError(CREDIT_TERM_RANGE_MESSAGE);
  }

  const rawStartDate = input.startDate;
  const startDate = rawStartDate
    ? normalizeDateOnly(rawStartDate, 'startDate').toISOString()
    : resolveDefaultStartDate();

  return {
    ...input,
    amount,
    interestRate,
    termMonths,
    startDate,
  };
};

const resolveCalculationMethod = ({ profile, input }) => {
  const requestedMethod = input.calculationMethod || profile.calculationMethod;
  return assertSupportedCalculationMethod(requestedMethod);
};

const resolveLateFeeMode = ({ profile, input }) => {
  const requestedMode = input.lateFeeMode || profile.parameters?.defaultLateFeeMode || 'NONE';
  return assertSupportedLateFeeMode(requestedMode);
};

const calculateCredit = ({ input, profileVersion, policySnapshot = null }) => {
  const profile = assertActiveProfile(profileVersion);
  const normalizedInput = normalizeCreditCalculationInput(input);
  const method = resolveCalculationMethod({ profile, input: normalizedInput });
  const lateFeeMode = resolveLateFeeMode({ profile, input: normalizedInput });
  const installmentAmount = profile.parameters?.allowCustomInstallmentAmount
    ? normalizedInput.installmentAmount
    : undefined;

  const schedule = buildAmortizationSchedule({
    ...normalizedInput,
    lateFeeMode,
    installmentAmount,
    calculationMethod: method,
  });
  const summary = summarizeSchedule(schedule);
  const immutablePolicySnapshot = buildPolicySnapshot({
    policySnapshot,
    profile,
    input: normalizedInput,
    method,
    lateFeeMode,
  });
  const explanation = buildCalculationExplanation({
    method,
    input: normalizedInput,
    profile,
    policySnapshot: immutablePolicySnapshot,
    summary,
    lateFeeMode,
  });

  return {
    calculationVersionId: profile.id,
    calculationProfileVersionId: profile.id,
    method,
    inputs: normalizedInput,
    policySnapshot: immutablePolicySnapshot,
    lateFeeMode,
    summary,
    schedule,
    explanation,
  };
};

module.exports = {
  calculateCredit,
  normalizeCreditCalculationInput,
};
