const { summarizeSchedule, buildAmortizationSchedule } = require('../../../services/creditFormulaHelpers');

/**
 * Build the persisted loan snapshot from a canonical amortization schedule.
 * @param {Array<object>} schedule
 * @returns {object}
 */
const buildFinancialSnapshot = (schedule) => summarizeSchedule(schedule);

/**
 * Return the canonical schedule and financial snapshot for persisted or legacy loan records.
 * @param {object} loan
 * @returns {{ schedule: Array<object>, snapshot: object }}
 */
const getCanonicalLoanView = (loan) => {
  const existingSchedule = Array.isArray(loan.emiSchedule) && loan.emiSchedule.length > 0
    ? loan.emiSchedule
    : buildAmortizationSchedule({
      amount: loan.amount,
      interestRate: loan.interestRate,
      termMonths: loan.termMonths,
      startDate: loan.startDate || new Date(),
    });

  const snapshot = loan.financialSnapshot && Object.keys(loan.financialSnapshot).length > 0
    ? {
      ...buildFinancialSnapshot(existingSchedule),
      ...loan.financialSnapshot,
    }
    : buildFinancialSnapshot(existingSchedule);

  return {
    schedule: existingSchedule,
    snapshot,
  };
};

/**
 * Create the loan read-model service shared across payment and reporting flows.
 * @returns {{ getCanonicalLoanView: Function, getSnapshot: Function }}
 */
const createLoanViewService = () => ({
  getCanonicalLoanView,
  getSnapshot(loan) {
    return getCanonicalLoanView(loan).snapshot;
  },
});

module.exports = {
  buildFinancialSnapshot,
  getCanonicalLoanView,
  createLoanViewService,
};
