const { Loan, Customer, Associate, FinancialProduct } = require('../../../models');
const { NotFoundError } = require('../../../utils/errorHandler');
const { simulateCredit } = require('../application/creditSimulationService');
const { buildFinancialSnapshot } = require('../application/loanFinancials');

const DEFAULT_FINANCIAL_PRODUCT_NAME = 'Personal Loan 12%';

const resolveSimulationExecution = ({ input, calculationService }) => {
  if (!calculationService) {
    const result = simulateCredit(input);
    return {
      selectedSource: 'legacy',
      result,
    };
  }

  return calculationService.calculate(input);
};

const resolveFinancialProductId = async ({ input, financialProductModel }) => {
  if (input.financialProductId) {
    return input.financialProductId;
  }

  const defaultProduct = await financialProductModel.findOne({
    where: { name: DEFAULT_FINANCIAL_PRODUCT_NAME },
  });

  if (!defaultProduct) {
    throw new NotFoundError(`FinancialProduct \"${DEFAULT_FINANCIAL_PRODUCT_NAME}\"`);
  }

  return defaultProduct.id;
};

/**
 * Create a loan record from canonical simulation data after validating linked records.
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

  const simulationExecution = resolveSimulationExecution({ input, calculationService });
  const simulation = simulationExecution.result;
  const financialProductId = await resolveFinancialProductId({ input, financialProductModel });
  const snapshot = {
    ...buildFinancialSnapshot(simulation.schedule),
    ...(simulation.summary || {}),
  };

  return loanModel.create({
    customerId: input.customerId,
    associateId: input.associateId || null,
    financialProductId,
    amount: input.amount,
    interestRate: input.interestRate,
    termMonths: input.termMonths,
    status: 'pending',
    lateFeeMode: simulation.lateFeeMode,
    emiSchedule: simulation.schedule,
    installmentAmount: snapshot.installmentAmount,
    totalPayable: snapshot.totalPayable,
    totalPaid: snapshot.totalPaid,
    principalOutstanding: snapshot.outstandingPrincipal,
    interestOutstanding: snapshot.outstandingInterest,
    financialSnapshot: snapshot,
  });
};

const createLoanFromCanonicalData = createLoanFromCanonicalDataFactory();

module.exports = {
  createLoanFromCanonicalData,
  createLoanFromCanonicalDataFactory,
  DEFAULT_FINANCIAL_PRODUCT_NAME,
};
