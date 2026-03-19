const { summarizeSchedule, buildAmortizationSchedule } = require('../../../services/creditFormulaHelpers');

const buildFinancialSnapshot = (schedule) => summarizeSchedule(schedule);

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
