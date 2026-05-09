const { ValidationError } = require('@/utils/errorHandler');
const {
  buildAmortizationSchedule,
  summarizeSchedule,
  calculateInstallmentAmount,
} = require('./amortizationMethods');
const { assertSupportedCalculationMethod } = require('./calculationMethods');
const { assertSupportedLateFeeMode } = require('./lateFeeCalculator');
const { buildCalculationExplanation } = require('./calculationExplainer');
const { buildPolicySnapshot } = require('./policySnapshotBuilder');
const { assertActiveProfile } = require('./calculationProfiles');

const addOneMonthClamped = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
};

const resolveDefaultFirstPaymentDate = () => addOneMonthClamped(new Date()).toISOString();

const normalizeCreditCalculationInput = (input = {}) => {
  const amount = Number(input.amount);
  const interestRate = Number(input.interestRate);
  const termMonths = Number(input.termMonths);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('amount must be greater than 0');
  }
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
    throw new ValidationError('interestRate must be between 0 and 100');
  }
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 360) {
    throw new ValidationError('termMonths must be an integer between 1 and 360');
  }

  const rawStartDate = input.startDate;
  const startDate = rawStartDate && !Number.isNaN(new Date(rawStartDate).getTime())
    ? rawStartDate
    : resolveDefaultFirstPaymentDate();

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
  calculateInstallmentAmount,
};
