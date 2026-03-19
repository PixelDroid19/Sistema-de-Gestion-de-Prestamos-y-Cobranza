const { sequelize, Loan, Payment } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errorHandler');
const { cloneSchedule, roundCurrency, summarizeSchedule } = require('./creditFormulaHelpers');

const INSTALLMENT_PAYMENT_TYPE = 'installment';
const PAYOFF_PAYMENT_TYPE = 'payoff';

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

const payableLoanStatuses = new Set(['approved', 'active', 'defaulted']);

const normalizePaymentDate = (paymentDate) => new Date(paymentDate);

const assertPayableLoanStatus = (loan) => {
  if (!payableLoanStatuses.has(loan.status)) {
    throw new ValidationError('Payments can only be applied to approved, active, or defaulted loans');
  }
};

const assertPositiveAmount = (amount) => {
  const numericAmount = roundCurrency(amount);
  if (numericAmount <= 0) {
    throw new ValidationError('Payment amount must be greater than 0');
  }

  return numericAmount;
};

const persistLoanSnapshot = ({ loan, snapshot, schedule, paymentDate, closeLoan = false, closureReason = null }) => {
  loan.emiSchedule = schedule;
  loan.installmentAmount = snapshot.installmentAmount;
  loan.totalPayable = snapshot.totalPayable;
  loan.totalPaid = snapshot.totalPaid;
  loan.principalOutstanding = snapshot.outstandingPrincipal;
  loan.interestOutstanding = snapshot.outstandingInterest;
  loan.lastPaymentDate = paymentDate;
  loan.financialSnapshot = snapshot;

  if (closeLoan) {
    loan.status = 'closed';
    loan.recoveryStatus = 'recovered';
    loan.closedAt = paymentDate;
    loan.closureReason = closureReason;
  } else if (loan.status === 'approved') {
    loan.status = 'active';
  }
};

const buildInstallmentPaymentCreatePayload = ({ loan, amount, paymentDate, principalApplied, interestApplied, overpaymentAmount, snapshot, allocations }) => ({
  loanId: loan.id,
  amount,
  paymentDate,
  status: 'completed',
  paymentType: INSTALLMENT_PAYMENT_TYPE,
  principalApplied,
  interestApplied,
  overpaymentAmount,
  remainingBalanceAfterPayment: snapshot.outstandingBalance,
  allocationBreakdown: allocations,
  paymentMetadata: {},
});

const buildPayoffAllocationBreakdown = (quote) => {
  const breakdown = [];

  if (quote.breakdown.overdueInterest > 0) {
    breakdown.push({ bucket: 'overdue_interest', amount: quote.breakdown.overdueInterest });
  }

  if (quote.breakdown.overduePrincipal > 0) {
    breakdown.push({ bucket: 'overdue_principal', amount: quote.breakdown.overduePrincipal });
  }

  if (quote.breakdown.accruedInterest > 0) {
    breakdown.push({ bucket: 'accrued_interest', amount: quote.breakdown.accruedInterest });
  }

  if (quote.breakdown.futurePrincipal > 0) {
    breakdown.push({ bucket: 'future_principal', amount: quote.breakdown.futurePrincipal });
  }

  return breakdown;
};

const buildPayoffPaymentCreatePayload = ({ loan, amount, paymentDate, quote, executedTotal }) => ({
  loanId: loan.id,
  amount,
  paymentDate,
  status: 'completed',
  paymentType: PAYOFF_PAYMENT_TYPE,
  principalApplied: roundCurrency(quote.breakdown.overduePrincipal + quote.breakdown.futurePrincipal),
  interestApplied: roundCurrency(quote.breakdown.overdueInterest + quote.breakdown.accruedInterest),
  overpaymentAmount: 0,
  remainingBalanceAfterPayment: 0,
  allocationBreakdown: buildPayoffAllocationBreakdown(quote),
  paymentMetadata: {
    payoff: {
      asOfDate: quote.asOfDate,
      accrualMethod: quote.accrualMethod,
      accruedDays: quote.accruedDays,
      breakdown: quote.breakdown,
      quotedTotal: quote.total,
      executedTotal,
    },
  },
});

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

      assertPayableLoanStatus(loan);

      const numericAmount = assertPositiveAmount(amount);

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
      const normalizedPaymentDate = normalizePaymentDate(paymentDate);

      persistLoanSnapshot({
        loan,
        snapshot,
        schedule,
        paymentDate: normalizedPaymentDate,
        closeLoan: snapshot.outstandingBalance <= 0.01,
        closureReason: snapshot.outstandingBalance <= 0.01 ? 'schedule_completion' : null,
      });

      await loan.save({ transaction });

      const payment = await paymentModel.create(buildInstallmentPaymentCreatePayload({
        loan,
        amount: numericAmount,
        paymentDate: normalizedPaymentDate,
        principalApplied,
        interestApplied,
        overpaymentAmount,
        snapshot,
        allocations,
      }), { transaction });

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

  const applyPayoff = async ({ loanId, asOfDate, quotedTotal, paymentDate = new Date() }) => {
    return sequelizeInstance.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      assertPayableLoanStatus(loan);

      const normalizedQuotedTotal = assertPositiveAmount(quotedTotal);
      const recomputedQuote = loanViewService.getPayoffQuote(loan, asOfDate);

      if (roundCurrency(recomputedQuote.total) !== normalizedQuotedTotal) {
        throw new ValidationError('Submitted payoff quote is stale or insufficient; request a new quote');
      }

      const normalizedPaymentDate = normalizePaymentDate(paymentDate);
      const payoffDate = new Date(`${recomputedQuote.asOfDate}T00:00:00.000Z`);
      const { schedule: canonicalSchedule } = loanViewService.getCanonicalLoanView(loan);
      const schedule = cloneSchedule(canonicalSchedule).map((row) => {
        const rowDueDate = new Date(row.dueDate);
        const isOverdueOrEarned = rowDueDate.getTime() <= payoffDate.getTime();
        const principalToApply = roundCurrency(row.remainingPrincipal || 0);
        const interestToApply = isOverdueOrEarned ? roundCurrency(row.remainingInterest || 0) : 0;

        return {
          ...row,
          paidPrincipal: roundCurrency((row.paidPrincipal || 0) + principalToApply),
          paidInterest: roundCurrency((row.paidInterest || 0) + interestToApply),
          paidTotal: roundCurrency((row.paidTotal || 0) + principalToApply + interestToApply),
          remainingPrincipal: 0,
          remainingInterest: 0,
          status: 'paid',
        };
      });
      const snapshot = summarizeSchedule(schedule);

      persistLoanSnapshot({
        loan,
        snapshot,
        schedule,
        paymentDate: normalizedPaymentDate,
        closeLoan: true,
        closureReason: 'payoff',
      });
      loan.closedAt = payoffDate;

      await loan.save({ transaction });

      const payment = await paymentModel.create(buildPayoffPaymentCreatePayload({
        loan,
        amount: normalizedQuotedTotal,
        paymentDate: normalizedPaymentDate,
        quote: recomputedQuote,
        executedTotal: normalizedQuotedTotal,
      }), { transaction });

      return {
        payment,
        loan,
        allocation: {
          principalApplied: payment.principalApplied,
          interestApplied: payment.interestApplied,
          overpaymentAmount: 0,
          remainingBalance: 0,
          outstandingInstallments: 0,
          nextInstallment: null,
          allocations: payment.allocationBreakdown,
          payoff: recomputedQuote,
        },
      };
    });
  };

  return {
    applyPayment,
    applyPayoff,
  };
};

module.exports = {
  createPaymentApplicationService,
};
