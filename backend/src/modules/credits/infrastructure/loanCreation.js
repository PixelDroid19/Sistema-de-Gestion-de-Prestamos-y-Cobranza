const { Loan, Customer, Associate, FinancialProduct } = require('@/models');
const { NotFoundError, ValidationError } = require('@/utils/errorHandler');
const {
  buildFinancialSnapshot,
  normalizeUtcDateOnly,
} = require('@/modules/credits/application/loanFinancials');

const DEFAULT_FINANCIAL_PRODUCT_NAME = 'Personal Loan 12%';
const DEFAULT_CALCULATION_SCOPE_KEY = 'credit-calculation';

/**
 * Execute the credit calculation through the profile-backed domain service.
 *
 * Returns { result, calculationProfileVersionId }.
 */
const resolveCreditCalculationExecution = async ({ input, calculationService, policySnapshot }) => {
  if (!calculationService) {
    throw new Error('calculationService is required. Calculation profiles are the single source of truth.');
  }

  const execution = await calculationService.calculate(input, { policySnapshot });
  return {
    result: execution.result,
    calculationProfileVersionId: execution.calculationProfileVersionId,
  };
};

const resolvePolicyContext = async ({ input, policyResolver }) => {
  if (!policyResolver || typeof policyResolver.resolve !== 'function') {
    return {
      calculationInput: { ...input },
      policySnapshot: null,
    };
  }

  return policyResolver.resolve({ input });
};

const resolveFinancialProductId = async ({ input, financialProductModel }) => {
  if (input.financialProductId) {
    return input.financialProductId;
  }

  const defaultProduct = await financialProductModel.findOne({
    where: { name: DEFAULT_FINANCIAL_PRODUCT_NAME },
  });

  if (!defaultProduct) {
    throw new NotFoundError(`FinancialProduct "${DEFAULT_FINANCIAL_PRODUCT_NAME}"`);
  }

  return defaultProduct.id;
};

/**
 * Normalize the operator-selected first payment date to UTC midnight.
 *
 * Browser date inputs submit `YYYY-MM-DD`, but integrations can send ISO
 * timestamps with offsets. Credit formulas already use the visible date prefix,
 * so persistence must preserve that same calendar day instead of shifting by
 * server timezone.
 *
 * @param {string|Date|null|undefined} value Selected first payment date.
 * @returns {Date} UTC date-only value.
 */
const resolveLoanStartDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return normalizeUtcDateOnly(new Date(), 'Loan start date');
  }

  const datePrefix = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(String(value).trim());
  const normalizedValue = datePrefix ? datePrefix[1] : value;

  try {
    return normalizeUtcDateOnly(normalizedValue, 'Loan start date');
  } catch (_error) {
    throw new ValidationError('Loan start date must be a valid date');
  }
};

/**
 * Create a loan record from canonical credit calculation data after validating linked records.
 *
 * The `calculationProfileVersionId` persisted on the loan comes directly from
 * the calculation execution result, guaranteeing it is the exact profile that
 * produced the numbers.
 *
 * @param {{ customerId: number, associateId?: number|null, amount: number, interestRate: number, termMonths: number, lateFeeMode?: string }} input
 * @returns {Promise<object>}
 */
const createLoanFromCanonicalDataFactory = ({
  calculationService,
  policyResolver,
  customerModel = Customer,
  associateModel = Associate,
  loanModel = Loan,
  financialProductModel = FinancialProduct,
} = {}) => async (input) => {
  const customer = await customerModel.findByPk(input.customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  if (input.associateId) {
    const associate = await associateModel.findByPk(input.associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }
  }

  const policyContext = await resolvePolicyContext({ input, policyResolver });
  const calculationInput = policyContext.calculationInput;
  const calculationExecution = await resolveCreditCalculationExecution({
    input: calculationInput,
    calculationService,
    policySnapshot: policyContext.policySnapshot,
  });
  const calculation = calculationExecution.result;
  const financialProductId = await resolveFinancialProductId({ input: calculationInput, financialProductModel });
  const startDate = resolveLoanStartDate(calculationInput.startDate);
  const calculationProfileVersionId = calculationExecution.calculationProfileVersionId;
  if (!calculationProfileVersionId) {
    throw new ValidationError('Credit calculation did not return an active calculation profile version. Production credit creation requires an approved calculation profile.');
  }

  const snapshot = {
    ...buildFinancialSnapshot(calculation.schedule),
    ...(calculation.summary || {}),
    calculationMethod: calculation.method,
    policySnapshot: calculation.policySnapshot || policyContext.policySnapshot || null,
    startDate: startDate.toISOString(),
  };
  const policySnapshot = snapshot.policySnapshot || null;
  const calculationMethod = snapshot.calculationMethod;
  if (!calculationMethod) {
    throw new ValidationError('Credit calculation did not return a calculation method');
  }

  return loanModel.create({
    customerId: calculationInput.customerId,
    associateId: calculationInput.associateId || null,
    financialProductId,
    amount: calculationInput.amount,
    interestRate: calculationInput.interestRate,
    termMonths: calculationInput.termMonths,
    calculationMethod,
    ratePolicyId: policySnapshot?.ratePolicyId ?? null,
    lateFeePolicyId: policySnapshot?.lateFeePolicyId ?? null,
    policySnapshot,
    status: 'pending',
    startDate,
    lateFeeMode: calculation.lateFeeMode,
    annualLateFeeRate: calculationInput.annualLateFeeRate ?? calculationInput.lateFeeRate ?? 0,
    emiSchedule: calculation.schedule,
    installmentAmount: snapshot.installmentAmount,
    totalPayable: snapshot.totalPayable,
    totalPaid: snapshot.totalPaid,
    principalOutstanding: snapshot.outstandingPrincipal,
    interestOutstanding: snapshot.outstandingInterest,
    financialSnapshot: snapshot,
    calculationProfileVersionId,
  });
};

const createLoanFromCanonicalData = createLoanFromCanonicalDataFactory();

module.exports = {
  createLoanFromCanonicalData,
  createLoanFromCanonicalDataFactory,
  DEFAULT_FINANCIAL_PRODUCT_NAME,
  DEFAULT_CALCULATION_SCOPE_KEY,
};
