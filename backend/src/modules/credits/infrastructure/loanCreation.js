const { Loan, Customer, Associate } = require('../../../models');
const { NotFoundError } = require('../../../utils/errorHandler');
const { simulateCredit } = require('../application/creditSimulationService');
const { buildFinancialSnapshot } = require('../application/loanFinancials');

/**
 * Create a loan record from canonical simulation data after validating linked records.
 * @param {{ customerId: number, associateId?: number|null, amount: number, interestRate: number, termMonths: number, lateFeeMode?: string }} input
 * @returns {Promise<object>}
 */
const createLoanFromCanonicalData = async (input) => {
  const customer = await Customer.findByPk(input.customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  if (input.associateId) {
    const associate = await Associate.findByPk(input.associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }
  }

  const simulation = simulateCredit(input);
  const snapshot = buildFinancialSnapshot(simulation.schedule);

  return Loan.create({
    customerId: input.customerId,
    associateId: input.associateId || null,
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

module.exports = {
  createLoanFromCanonicalData,
};
