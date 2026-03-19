const { sequelize, Loan, Payment } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errorHandler');
const { cloneSchedule, roundCurrency, summarizeSchedule } = require('./creditFormulaHelpers');

/**
 * Refresh an installment row status after payment allocation mutates its balances.
 * @param {object} row
 */
const updateRowStatus = (row) => {
  const outstanding = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));

  if (outstanding <= 0) {
    row.status = 'paid';
  } else if ((row.paidTotal || 0) > 0) {
    row.status = 'partial';
  } else {
    row.status = 'pending';
  }
};

/**
 * Create the payment application service that mutates canonical schedules and payment records together.
 * @param {{ sequelizeInstance?: object, loanModel?: object, paymentModel?: object, loanViewService: { getCanonicalLoanView: Function } }} [options]
 * @returns {{ applyPayment: Function }}
 */
const createPaymentApplicationService = ({
  sequelizeInstance = sequelize,
  loanModel = Loan,
  paymentModel = Payment,
  loanViewService,
} = {}) => {
  const payableLoanStatuses = new Set(['approved', 'active', 'defaulted']);

  if (!loanViewService || typeof loanViewService.getCanonicalLoanView !== 'function') {
    throw new Error('paymentApplicationService requires a loanViewService with getCanonicalLoanView()');
  }

  /**
   * Apply a payment to the next outstanding interest and principal buckets in the canonical schedule.
   * @param {{ loanId: number, amount: number, paymentDate?: string|Date }} input
   * @returns {Promise<{ payment: object, loan: object, allocation: object }>}
   */
  const applyPayment = async ({ loanId, amount, paymentDate = new Date() }) => {
    return sequelizeInstance.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      if (!payableLoanStatuses.has(loan.status)) {
        throw new ValidationError('Payments can only be applied to approved, active, or defaulted loans');
      }

      const numericAmount = roundCurrency(amount);
      if (numericAmount <= 0) {
        throw new ValidationError('Payment amount must be greater than 0');
      }

      const { schedule: canonicalSchedule } = loanViewService.getCanonicalLoanView(loan);
      const schedule = cloneSchedule(canonicalSchedule);
      let remainingPayment = numericAmount;
      const allocations = [];
      let principalApplied = 0;
      let interestApplied = 0;

      for (const row of schedule) {
        if (remainingPayment <= 0) {
          break;
        }

        const rowOutstanding = roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0));
        if (rowOutstanding <= 0) {
          updateRowStatus(row);
          continue;
        }

        const applyInterest = Math.min(remainingPayment, roundCurrency(row.remainingInterest || 0));
        row.paidInterest = roundCurrency((row.paidInterest || 0) + applyInterest);
        row.remainingInterest = roundCurrency((row.remainingInterest || 0) - applyInterest);
        remainingPayment = roundCurrency(remainingPayment - applyInterest);
        interestApplied = roundCurrency(interestApplied + applyInterest);

        const applyPrincipal = Math.min(remainingPayment, roundCurrency(row.remainingPrincipal || 0));
        row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + applyPrincipal);
        row.remainingPrincipal = roundCurrency((row.remainingPrincipal || 0) - applyPrincipal);
        remainingPayment = roundCurrency(remainingPayment - applyPrincipal);
        principalApplied = roundCurrency(principalApplied + applyPrincipal);

        row.paidTotal = roundCurrency((row.paidTotal || 0) + applyInterest + applyPrincipal);
        updateRowStatus(row);

        allocations.push({
          installmentNumber: row.installmentNumber,
          interestApplied: applyInterest,
          principalApplied: applyPrincipal,
          remainingInstallmentBalance: roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0)),
          status: row.status,
        });
      }

      const snapshot = summarizeSchedule(schedule);
      const overpaymentAmount = roundCurrency(remainingPayment);
      const normalizedPaymentDate = new Date(paymentDate);

      loan.emiSchedule = schedule;
      loan.installmentAmount = snapshot.installmentAmount;
      loan.totalPayable = snapshot.totalPayable;
      loan.totalPaid = snapshot.totalPaid;
      loan.principalOutstanding = snapshot.outstandingPrincipal;
      loan.interestOutstanding = snapshot.outstandingInterest;
      loan.lastPaymentDate = normalizedPaymentDate;
      loan.financialSnapshot = snapshot;

      if (snapshot.outstandingBalance <= 0.01) {
        loan.status = 'closed';
        loan.recoveryStatus = 'recovered';
      } else if (loan.status === 'approved') {
        loan.status = 'active';
      }

      await loan.save({ transaction });

      const payment = await paymentModel.create({
        loanId: loan.id,
        amount: numericAmount,
        paymentDate: normalizedPaymentDate,
        status: 'completed',
        principalApplied,
        interestApplied,
        overpaymentAmount,
        remainingBalanceAfterPayment: snapshot.outstandingBalance,
        allocationBreakdown: allocations,
      }, { transaction });

      return {
        payment,
        loan,
        allocation: {
          principalApplied,
          interestApplied,
          overpaymentAmount,
          remainingBalance: snapshot.outstandingBalance,
          outstandingInstallments: snapshot.outstandingInstallments,
          nextInstallment: snapshot.nextInstallment,
          allocations,
        },
      };
    });
  };

  return {
    applyPayment,
  };
};

module.exports = {
  createPaymentApplicationService,
};
