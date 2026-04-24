const { Loan, Customer, Associate, FinancialProduct } = require('@/models');
const { NotFoundError, ValidationError } = require('@/utils/errorHandler');
const { buildFinancialSnapshot } = require('@/modules/credits/application/loanFinancials');

const DEFAULT_FINANCIAL_PRODUCT_NAME = 'Personal Loan 12%';
const DEFAULT_DAG_SCOPE_KEY = 'credit-simulation';

/**
 * Execute the credit calculation via calculationService (async — loads persisted graph).
 *
 * Returns { result, graphVersionId }.
 */
const resolveCreditCalculationExecution = async ({ input, calculationService }) => {
  if (!calculationService) {
    throw new Error('calculationService is required. DAG is the single source of truth.');
  }

  const execution = await calculationService.calculate(input);
  return {
    result: execution.result,
    graphVersionId: execution.graphVersionId || null,
  };
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
 * Create a loan record from canonical credit calculation data after validating linked records.
 *
 * The `dagGraphVersionId` persisted on the loan now comes directly from the
 * calculation execution result, guaranteeing it is the exact graph that produced
 * the numbers — no more separate DB query that could return a different version.
 *
 * @param {{ customerId: number, associateId?: number|null, amount: number, interestRate: number, termMonths: number, lateFeeMode?: string }} input
 * @returns {Promise<object>}
 */
const createLoanFromCanonicalDataFactory = ({
  calculationService,
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

  const calculationExecution = await resolveCreditCalculationExecution({ input, calculationService });
  const calculation = calculationExecution.result;
  const financialProductId = await resolveFinancialProductId({ input, financialProductModel });

  // graphVersionId comes from the execution — the exact graph that produced these numbers
  const dagGraphVersionId = calculationExecution.graphVersionId;
  if (!dagGraphVersionId) {
    throw new ValidationError('Credit calculation did not return a DAG formula version. Production credit creation requires an active DAG formula.');
  }

  const snapshot = {
    ...buildFinancialSnapshot(calculation.schedule),
    ...(calculation.summary || {}),
    calculationMethod: calculation.calculationMethod || 'FRENCH',
  };

  return loanModel.create({
    customerId: input.customerId,
    associateId: input.associateId || null,
    financialProductId,
    amount: input.amount,
    interestRate: input.interestRate,
    termMonths: input.termMonths,
    status: 'pending',
    lateFeeMode: calculation.lateFeeMode,
    annualLateFeeRate: input.annualLateFeeRate ?? input.lateFeeRate ?? 0,
    emiSchedule: calculation.schedule,
    installmentAmount: snapshot.installmentAmount,
    totalPayable: snapshot.totalPayable,
    totalPaid: snapshot.totalPaid,
    principalOutstanding: snapshot.outstandingPrincipal,
    interestOutstanding: snapshot.outstandingInterest,
    financialSnapshot: snapshot,
    dagGraphVersionId,
  });
};

const createLoanFromCanonicalData = createLoanFromCanonicalDataFactory();

module.exports = {
  createLoanFromCanonicalData,
  createLoanFromCanonicalDataFactory,
  DEFAULT_FINANCIAL_PRODUCT_NAME,
  DEFAULT_DAG_SCOPE_KEY,
};
