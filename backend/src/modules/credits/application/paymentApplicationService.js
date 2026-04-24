const crypto = require('crypto');
const { sequelize, Loan, Payment, IdempotencyKey } = require('@/models');
const { NotFoundError, ValidationError, AuthorizationError, IdempotentReplayError } = require('@/utils/errorHandler');
const { cloneSchedule, roundCurrency, summarizeSchedule, calculateLateFee } = require('./creditFormulaHelpers');
const {
  PAYABLE_LOAN_STATUSES,
  assertCapitalPaymentAllowed,
  assertPayoffAllowed,
} = require('./paymentEligibility');

const INSTALLMENT_PAYMENT_TYPE = 'installment';
const PAYOFF_PAYMENT_TYPE = 'payoff';
const PARTIAL_PAYMENT_TYPE = 'partial';
const CAPITAL_PAYMENT_TYPE = 'capital';
const VALID_PAYMENT_METHODS = ['cash', 'transfer', 'card', 'check', 'other'];

const _INSTALLMENT_STATUSES = new Set(['pending', 'overdue', 'paid', 'partial', 'annulled']);
const CANCELLABLE_STATUSES = new Set(['pending', 'overdue']);

/**
 * Determine if an installment is overdue based on its due date.
 * @param {object} row - Installment row
 * @param {Date} asOfDate - Date to check against (defaults to now)
 * @returns {boolean}
 */
const isInstallmentOverdue = (row, asOfDate = new Date()) => {
  if (row.status === 'paid' || row.status === 'annulled') {
    return false;
  }
  const dueDate = new Date(row.dueDate);
  return dueDate < asOfDate;
};

const normalizeScheduleStatuses = (schedule, asOfDate = new Date()) => {
  schedule.forEach((row) => updateRowStatus(row, asOfDate));
  return schedule;
};

/**
 * Calculate the late fee for an overdue installment row.
 * Uses the loan's lateFeeMode and annualLateFeeRate.
 * @param {object} row - Installment row
 * @param {object} loan - Loan entity
 * @param {Date} asOfDate - Date to calculate against
 * @returns {number} Late fee amount (rounded)
 */
const calculateInstallmentLateFee = (row, loan, asOfDate = new Date()) => {
  if (row.status === 'paid' || row.status === 'annulled') {
    return 0;
  }
  const dueDate = new Date(row.dueDate);
  if (dueDate >= asOfDate) {
    return 0;
  }

  const daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysOverdue <= 0) return 0;

  const overdueAmount = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
  if (overdueAmount <= 0) return 0;

  // Late fee is calculated on the interest portion of the overdue installment
  const overdueInterestAmount = roundCurrency(row.remainingInterest || 0);
  const annualRate = Number(loan.annualLateFeeRate || 0);
  const feeMode = String(loan.lateFeeMode || 'SIMPLE').toUpperCase();

  return calculateLateFee({
    overdueAmount: overdueInterestAmount > 0 ? overdueInterestAmount : overdueAmount,
    daysOverdue,
    feeMode,
    annualRate,
  });
};

/**
 * Refresh an installment row status after payment allocation mutates its balances.
 * @param {object} row
 */
const updateRowStatus = (row, asOfDate = new Date()) => {
  const outstanding = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));

  if (row.status === 'annulled') {
    // Don't change annulled status
    return;
  }

  if (outstanding <= 0) {
    row.status = 'paid';
  } else if (isInstallmentOverdue(row, asOfDate)) {
    row.status = 'overdue';
  } else if ((row.paidTotal || 0) > 0) {
    row.status = 'partial';
  } else {
    row.status = 'pending';
  }
};

const buildSnapshot = (schedule) => {
  const actionableRows = schedule.filter((row) => row.status !== 'annulled');
  const rawSnapshot = summarizeSchedule(actionableRows);
  const nextInstallment = actionableRows.find((row) => (
    roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0)) > 0
  )) || null;

  return {
    ...rawSnapshot,
    outstandingInstallments: actionableRows.filter((row) => row.status !== 'paid').length,
    nextInstallment: nextInstallment ? {
      installmentNumber: nextInstallment.installmentNumber,
      dueDate: nextInstallment.dueDate,
      scheduledPayment: roundCurrency(nextInstallment.scheduledPayment),
      remainingPrincipal: roundCurrency(nextInstallment.remainingPrincipal),
      remainingInterest: roundCurrency(nextInstallment.remainingInterest),
    } : null,
  };
};

const normalizePaymentDate = (paymentDate) => new Date(paymentDate);

const assertPayableLoanStatus = (loan) => {
  if (!PAYABLE_LOAN_STATUSES.has(loan.status)) {
    throw new ValidationError('Payments can only be applied to pending, approved, active, overdue, or defaulted loans');
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
  } else if (loan.status === 'pending' || loan.status === 'approved') {
    loan.status = 'active';
  }
};

const buildInstallmentPaymentCreatePayload = ({
  loan,
  amount,
  paymentDate,
  principalApplied,
  interestApplied,
  penaltyApplied = 0,
  additionalPrincipalApplied = 0,
  overpaymentAmount,
  unappliedOverpaymentAmount = 0,
  snapshot,
  allocations,
  installmentNumber,
  paymentMethod,
}) => ({
  loanId: loan.id,
  amount,
  paymentDate,
  status: 'completed',
  paymentType: INSTALLMENT_PAYMENT_TYPE,
  principalApplied,
  interestApplied,
  penaltyApplied,
  overpaymentAmount,
  remainingBalanceAfterPayment: snapshot.outstandingBalance,
  allocationBreakdown: allocations,
  paymentMetadata: {
    penaltyApplied,
    additionalPrincipalApplied,
    unappliedOverpaymentAmount,
  },
  paymentMethod,
  installmentNumber,
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
 * Build partial payment payload (free amount, goes to interest then principal)
 */
const buildPartialPaymentCreatePayload = ({ loan, amount, paymentDate, principalApplied, interestApplied, remainingBalanceAfterPayment }) => ({
  loanId: loan.id,
  amount,
  paymentDate,
  status: 'completed',
  paymentType: PARTIAL_PAYMENT_TYPE,
  principalApplied,
  interestApplied,
  overpaymentAmount: 0,
  remainingBalanceAfterPayment,
  allocationBreakdown: [],
  paymentMetadata: { partial: true },
});

/**
 * Build capital payment payload (reduces principal directly)
 */
const buildCapitalPaymentCreatePayload = ({ loan, amount, paymentDate, principalApplied, snapshot, strategy }) => ({
  loanId: loan.id,
  amount,
  paymentDate,
  status: 'completed',
  paymentType: CAPITAL_PAYMENT_TYPE,
  principalApplied,
  interestApplied: 0,
  overpaymentAmount: 0,
  remainingBalanceAfterPayment: snapshot.outstandingBalance,
  allocationBreakdown: [],
  paymentMetadata: {
    capital_reduction: true,
    strategy: strategy || 'REDUCE_TIME',
  },
});

const buildProcessPaymentMetadata = ({ idempotencyKey }) => ({
  ...(idempotencyKey ? { idempotencyKey } : {}),
  processedVia: 'canonical_waterfall',
});

/**
 * Create the payment application service that mutates canonical schedules and payment records together.
 */
const createPaymentApplicationService = ({
  sequelizeInstance = sequelize,
  loanModel = Loan,
  paymentModel = Payment,
  loanViewService,
  clock = () => new Date(),
  eventPublisher = { publishAmortizationCalculatedEvent: async () => {} },
} = {}) => {
  if (!loanViewService || typeof loanViewService.getCanonicalLoanView !== 'function') {
    throw new Error('paymentApplicationService requires a loanViewService with getCanonicalLoanView()');
  }

  /**
   * Apply a payment following the waterfall order:
   * 1. Penalizaciones por mora (late fees/penalties) — if any overdue installments exist
   * 2. Intereses normales (normal interest) from overdue installments
   * 3. Capital de la cuota (installment principal) from overdue installments
   * 4. Intereses normales from current/future installments
   * 5. Capital de la cuota from current/future installments
   * 6. Abonos adicionales a capital (excess overpayment reduces future principal)
   */
  const executeInstallmentPayment = async ({ loanId, amount, paymentDate = clock(), transaction, paymentMetadata = null, paymentMethod = null }) => {
    const run = async (transactionContext) => {
      const transaction = transactionContext;
      const loan = await loanModel.findByPk(loanId, { transaction, lock: true });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      assertPayableLoanStatus(loan);

      const numericAmount = assertPositiveAmount(amount);
      if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
        throw new ValidationError(`Invalid payment method. Must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
      }

      const normalizedPaymentDate = normalizePaymentDate(paymentDate);
      const { schedule: canonicalSchedule } = loanViewService.getCanonicalLoanView(loan);
      const schedule = normalizeScheduleStatuses(cloneSchedule(canonicalSchedule), normalizedPaymentDate);
      const now = normalizedPaymentDate;
      let remainingPayment = numericAmount;
      const allocations = [];
      let totalPrincipalApplied = 0;
      let totalInterestApplied = 0;
      let penaltyApplied = 0;
      let additionalPrincipalApplied = 0;
      let targetInstallment = null;

      // ── Phase 1: Collect all overdue installments first ───────────────────────
      // If any installment is overdue, ALL overdue amounts must be paid first
      // (penalty interest + overdue interest + overdue principal)
      const hasOverdue = schedule.some((row) => {
        const outstanding = (row.remainingPrincipal || 0) + (row.remainingInterest || 0);
        return outstanding > 0 && row.status === 'overdue';
      });

      if (hasOverdue) {
        // Penalizaciones por mora: iterate overdue installments and pay late fees first, then interest, then principal
        for (const row of schedule) {
          if (remainingPayment <= 0) break;

          const outstanding = roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0));
          if (outstanding <= 0 || row.status !== 'overdue') {
            updateRowStatus(row, now);
            continue;
          }

          // Penalizaciones por mora: calculate and collect late fee first
          const lateFee = calculateInstallmentLateFee(row, loan, now);
          const applyLateFee = Math.min(remainingPayment, lateFee);
          penaltyApplied = roundCurrency(penaltyApplied + applyLateFee);
          remainingPayment = roundCurrency(remainingPayment - applyLateFee);

          // Intereses normales: interest portion next
          const applyInterest = Math.min(remainingPayment, roundCurrency(row.remainingInterest || 0));
          row.paidInterest = roundCurrency((row.paidInterest || 0) + applyInterest);
          row.remainingInterest = roundCurrency((row.remainingInterest || 0) - applyInterest);
          remainingPayment = roundCurrency(remainingPayment - applyInterest);
          totalInterestApplied = roundCurrency(totalInterestApplied + applyInterest);

          // Capital de la cuota: then principal
          const applyPrincipal = Math.min(remainingPayment, roundCurrency(row.remainingPrincipal || 0));
          row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + applyPrincipal);
          row.remainingPrincipal = roundCurrency((row.remainingPrincipal || 0) - applyPrincipal);
          remainingPayment = roundCurrency(remainingPayment - applyPrincipal);
          totalPrincipalApplied = roundCurrency(totalPrincipalApplied + applyPrincipal);

          row.paidTotal = roundCurrency((row.paidTotal || 0) + applyInterest + applyPrincipal);
          updateRowStatus(row, now);

          if (!targetInstallment && (row.paidPrincipal > 0 || row.paidInterest > 0 || applyLateFee > 0)) {
            targetInstallment = row.installmentNumber;
          }

          allocations.push({
            installmentNumber: row.installmentNumber,
            interestApplied: applyInterest,
            principalApplied: applyPrincipal,
            lateFeeApplied: applyLateFee,
            remainingInstallmentBalance: roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0)),
            status: row.status,
            bucket: 'overdue',
          });
        }
      }

      // ── Phase 2: Pay current/future installments in order ─────────────────────
      if (remainingPayment > 0) {
        for (const row of schedule) {
          if (remainingPayment <= 0) break;

          const outstanding = roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0));
          if (outstanding <= 0 || row.status === 'annulled') {
            updateRowStatus(row, now);
            continue;
          }

          const existingAlloc = allocations.find((allocation) => allocation.installmentNumber === row.installmentNumber);
          if (existingAlloc) {
            continue;
          }

          const applyInterest = Math.min(remainingPayment, roundCurrency(row.remainingInterest || 0));
          row.paidInterest = roundCurrency((row.paidInterest || 0) + applyInterest);
          row.remainingInterest = roundCurrency((row.remainingInterest || 0) - applyInterest);
          remainingPayment = roundCurrency(remainingPayment - applyInterest);
          totalInterestApplied = roundCurrency(totalInterestApplied + applyInterest);

          const applyPrincipal = Math.min(remainingPayment, roundCurrency(row.remainingPrincipal || 0));
          row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + applyPrincipal);
          row.remainingPrincipal = roundCurrency((row.remainingPrincipal || 0) - applyPrincipal);
          remainingPayment = roundCurrency(remainingPayment - applyPrincipal);
          totalPrincipalApplied = roundCurrency(totalPrincipalApplied + applyPrincipal);

          row.paidTotal = roundCurrency((row.paidTotal || 0) + applyInterest + applyPrincipal);
          updateRowStatus(row, now);

          if (!targetInstallment && (row.paidPrincipal > 0 || row.paidInterest > 0)) {
            targetInstallment = row.installmentNumber;
          }

          allocations.push({
            installmentNumber: row.installmentNumber,
            interestApplied: applyInterest,
            principalApplied: applyPrincipal,
            lateFeeApplied: 0,
            remainingInstallmentBalance: roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0)),
            status: row.status,
            bucket: 'scheduled',
          });
        }
      }

      // ── Phase 3: Abonos adicionales a capital ────────────────────────────────
      // Any excess after clearing overdue debt and the next scheduled installment
      // goes directly to principal reduction without prepaying future interest.
      const overpaymentAmount = roundCurrency(remainingPayment);
      let remainingOverpayment = overpaymentAmount;
      if (overpaymentAmount > 0) {
        for (const row of schedule) {
          if (remainingOverpayment <= 0) break;
          if (row.status === 'annulled') continue;

          const rowPrincipal = roundCurrency(row.remainingPrincipal || 0);
          if (rowPrincipal <= 0) continue;

          const reduction = Math.min(rowPrincipal, remainingOverpayment);
          row.remainingPrincipal = roundCurrency(rowPrincipal - reduction);
          row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + reduction);
          row.paidTotal = roundCurrency((row.paidTotal || 0) + reduction);
          remainingOverpayment = roundCurrency(remainingOverpayment - reduction);
          totalPrincipalApplied = roundCurrency(totalPrincipalApplied + reduction);
          additionalPrincipalApplied = roundCurrency(additionalPrincipalApplied + reduction);
          updateRowStatus(row, now);

          if (!targetInstallment) {
            targetInstallment = row.installmentNumber;
          }

          const existingAlloc = allocations.find((a) => a.installmentNumber === row.installmentNumber);
          if (existingAlloc) {
            existingAlloc.principalApplied = roundCurrency(existingAlloc.principalApplied + reduction);
            existingAlloc.remainingInstallmentBalance = roundCurrency((row.remainingInterest || 0) + row.remainingPrincipal);
            existingAlloc.status = row.status;
          }
          else {
            allocations.push({
              installmentNumber: row.installmentNumber,
              interestApplied: 0,
              principalApplied: reduction,
              remainingInstallmentBalance: roundCurrency((row.remainingInterest || 0) + row.remainingPrincipal),
              status: row.status,
              bucket: 'additional_principal',
            });
          }
        }
      }

      const snapshot = buildSnapshot(schedule);
      const unappliedOverpaymentAmount = roundCurrency(remainingOverpayment);

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
        principalApplied: totalPrincipalApplied,
        interestApplied: totalInterestApplied,
        penaltyApplied,
        additionalPrincipalApplied,
        overpaymentAmount,
        unappliedOverpaymentAmount,
        snapshot,
        allocations,
        installmentNumber: targetInstallment,
        paymentMethod,
      }), { transaction });

      if (paymentMetadata && typeof payment.update === 'function') {
        await payment.update({
          paymentMetadata: {
            ...(payment.paymentMetadata || {}),
            ...paymentMetadata,
          },
        }, { transaction });
      }

      return {
        payment,
        loan,
        allocation: {
          principalApplied: totalPrincipalApplied,
          interestApplied: totalInterestApplied,
          penaltyApplied,
          additionalPrincipalApplied,
          overpaymentAmount,
          unappliedOverpaymentAmount,
          remainingBalance: snapshot.outstandingBalance,
          outstandingInstallments: snapshot.outstandingInstallments,
          nextInstallment: snapshot.nextInstallment,
          allocations,
        },
      };
    };

    if (transaction) {
      return run(transaction);
    }

    return sequelizeInstance.transaction(async (createdTransaction) => run(createdTransaction));
  };

  const applyPayment = async ({ loanId, amount, paymentDate = clock(), paymentMethod }) => {
    return executeInstallmentPayment({ loanId, amount, paymentDate, paymentMethod });
  };

  /**
   * Apply a partial payment (free amount within limits).
   * Follows the same overdue-first waterfall: penalizaciones → intereses → capital.
   */
  const applyPartialPayment = async ({ loanId, amount, paymentDate = clock() }) => {
    return sequelizeInstance.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction, lock: true });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      assertPayableLoanStatus(loan);

      const numericAmount = assertPositiveAmount(amount);

      const normalizedPaymentDate = normalizePaymentDate(paymentDate);
      const { schedule: canonicalSchedule } = loanViewService.getCanonicalLoanView(loan);
      const schedule = normalizeScheduleStatuses(cloneSchedule(canonicalSchedule), normalizedPaymentDate);
      const now = normalizedPaymentDate;

      // Collect all overdue installments first
      const hasOverdue = schedule.some((row) => {
        const outstanding = (row.remainingPrincipal || 0) + (row.remainingInterest || 0);
        return outstanding > 0 && row.status === 'overdue';
      });

      let remainingPayment = numericAmount;
      let totalPrincipalApplied = 0;
      let totalInterestApplied = 0;

      if (hasOverdue) {
        // Penalizaciones por mora: pay late fees on overdue installments first
        let penaltyAppliedPartial = 0;
        for (const row of schedule) {
          if (remainingPayment <= 0) break;

          const outstanding = roundCurrency((row.remainingInterest || 0) + (row.remainingPrincipal || 0));
          if (outstanding <= 0 || row.status !== 'overdue') continue;

          // Late fee first
          const lateFee = calculateInstallmentLateFee(row, loan, now);
          const applyLateFee = Math.min(remainingPayment, lateFee);
          penaltyAppliedPartial = roundCurrency(penaltyAppliedPartial + applyLateFee);
          remainingPayment = roundCurrency(remainingPayment - applyLateFee);

          // Interest first (penalty + normal interest)
          const interestToApply = Math.min(remainingPayment, roundCurrency(row.remainingInterest || 0));
          row.paidInterest = roundCurrency((row.paidInterest || 0) + interestToApply);
          row.remainingInterest = roundCurrency((row.remainingInterest || 0) - interestToApply);
          remainingPayment = roundCurrency(remainingPayment - interestToApply);
          totalInterestApplied = roundCurrency(totalInterestApplied + interestToApply);

          // Capital de la cuota: then principal
          const principalToApply = Math.min(remainingPayment, roundCurrency(row.remainingPrincipal || 0));
          row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + principalToApply);
          row.remainingPrincipal = roundCurrency((row.remainingPrincipal || 0) - principalToApply);
          remainingPayment = roundCurrency(remainingPayment - principalToApply);
          totalPrincipalApplied = roundCurrency(totalPrincipalApplied + principalToApply);

          row.paidTotal = roundCurrency((row.paidTotal || 0) + interestToApply + principalToApply);
          updateRowStatus(row, now);
        }
      }

      // If still have payment left and not fully allocated, apply to current/future installments
      if (remainingPayment > 0) {
        // Iterate through all non-paid, non-annulled installments and carry forward excess
        for (const row of schedule) {
          if (remainingPayment <= 0) break;

          const installmentOutstanding = roundCurrency(
            (row.remainingInterest || 0) + (row.remainingPrincipal || 0)
          );
          if (installmentOutstanding <= 0 || row.status === 'annulled' || row.status === 'overdue') continue;

          const cappedAmount = Math.min(remainingPayment, installmentOutstanding);

          const interestToApply = Math.min(cappedAmount, roundCurrency(row.remainingInterest || 0));
          const principalToApply = roundCurrency(cappedAmount - interestToApply);

          row.paidInterest = roundCurrency((row.paidInterest || 0) + interestToApply);
          row.remainingInterest = roundCurrency((row.remainingInterest || 0) - interestToApply);
          row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + principalToApply);
          row.remainingPrincipal = roundCurrency((row.remainingPrincipal || 0) - principalToApply);
          row.paidTotal = roundCurrency((row.paidTotal || 0) + interestToApply + principalToApply);
          updateRowStatus(row, now);

          totalInterestApplied = roundCurrency(totalInterestApplied + interestToApply);
          totalPrincipalApplied = roundCurrency(totalPrincipalApplied + principalToApply);
        }
      }

      const snapshot = buildSnapshot(schedule);

      persistLoanSnapshot({
        loan,
        snapshot,
        schedule,
        paymentDate: normalizedPaymentDate,
        closeLoan: snapshot.outstandingBalance <= 0.01,
        closureReason: snapshot.outstandingBalance <= 0.01 ? 'schedule_completion' : null,
      });

      await loan.save({ transaction });

      const payment = await paymentModel.create(buildPartialPaymentCreatePayload({
        loan,
        amount: numericAmount,
        paymentDate: normalizedPaymentDate,
        principalApplied: totalPrincipalApplied,
        interestApplied: totalInterestApplied,
        remainingBalanceAfterPayment: snapshot.outstandingBalance,
      }), { transaction });

      return {
        payment,
        loan,
        allocation: {
          amount: numericAmount,
          principalApplied: totalPrincipalApplied,
          interestApplied: totalInterestApplied,
          remainingBalance: snapshot.outstandingBalance,
          installmentNumber: schedule.find((r) => (r.paidPrincipal > 0 || r.paidInterest > 0))?.installmentNumber || null,
        },
      };
    });
  };

  /**
   * Apply a capital payment (reduces debt principal directly)
   */
  const applyCapitalPayment = async ({ loanId, amount, paymentDate = clock(), strategy = 'REDUCE_TIME' }) => {
    return sequelizeInstance.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction, lock: true });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      assertPayableLoanStatus(loan);

      const numericAmount = assertPositiveAmount(amount);

      const normalizedPaymentDate = normalizePaymentDate(paymentDate);
      const { schedule: canonicalSchedule, snapshot: canonicalSnapshot } = loanViewService.getCanonicalLoanView(loan);
      const schedule = normalizeScheduleStatuses(cloneSchedule(canonicalSchedule), normalizedPaymentDate);

      assertCapitalPaymentAllowed({
        loan,
        schedule,
        snapshot: canonicalSnapshot,
        asOfDate: normalizedPaymentDate,
      });

      const principalReduction = Math.min(numericAmount, roundCurrency(canonicalSnapshot.outstandingPrincipal || loan.principalOutstanding || 0));

      // Find installments with remaining principal and reduce debt directly.
      let principalRemaining = principalReduction;
      for (const row of schedule) {
        if (principalRemaining <= 0) break;
        
        const rowPrincipal = roundCurrency(row.remainingPrincipal || 0);
        if (rowPrincipal <= 0) continue;

        const reduction = Math.min(rowPrincipal, principalRemaining);
        row.remainingPrincipal = roundCurrency(rowPrincipal - reduction);
        row.paidPrincipal = roundCurrency((row.paidPrincipal || 0) + reduction);
        row.paidTotal = roundCurrency((row.paidTotal || 0) + reduction);
        principalRemaining = roundCurrency(principalRemaining - reduction);
        updateRowStatus(row, normalizedPaymentDate);
      }

      const snapshot = buildSnapshot(schedule);

      persistLoanSnapshot({
        loan,
        snapshot,
        schedule,
        paymentDate: normalizedPaymentDate,
      });

      await loan.save({ transaction });

      const payment = await paymentModel.create(buildCapitalPaymentCreatePayload({
        loan,
        amount: principalReduction,
        paymentDate: normalizedPaymentDate,
        principalApplied: principalReduction,
        snapshot,
        strategy,
      }), { transaction });

      return {
        payment,
        loan,
        allocation: {
          amount: principalReduction,
          principalApplied: principalReduction,
          remainingPrincipalOutstanding: snapshot.outstandingPrincipal,
          strategyRequested: strategy,
          strategyApplied: 'REDUCE_TIME',
        },
      };
    });
  };

  /**
   * Apply payoff (total payment to close the loan)
   */
  const applyPayoff = async ({ loanId, asOfDate, quotedTotal, paymentDate = clock() }) => {
    return sequelizeInstance.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction, lock: true });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      const normalizedQuotedTotal = assertPositiveAmount(quotedTotal);
      const { schedule, snapshot } = loanViewService.getCanonicalLoanView(loan);
      const payoffDate = new Date(`${asOfDate}T00:00:00.000Z`);

      assertPayoffAllowed({
        loan,
        schedule,
        snapshot,
        asOfDate: payoffDate,
      });

      const recomputedQuote = loanViewService.getPayoffQuote(loan, asOfDate);

      if (roundCurrency(recomputedQuote.total) !== normalizedQuotedTotal) {
        throw new ValidationError('Submitted payoff quote is stale or insufficient; request a new quote');
      }

      const normalizedPaymentDate = normalizePaymentDate(paymentDate);
      const appliedPayoffDate = new Date(`${recomputedQuote.asOfDate}T00:00:00.000Z`);
      const settledSchedule = cloneSchedule(schedule).map((row) => {
        const rowDueDate = new Date(row.dueDate);
        const isOverdueOrEarned = rowDueDate.getTime() <= appliedPayoffDate.getTime();
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
      const payoffSnapshot = buildSnapshot(settledSchedule);

      persistLoanSnapshot({
        loan,
        snapshot: payoffSnapshot,
        schedule: settledSchedule,
        paymentDate: normalizedPaymentDate,
        closeLoan: true,
        closureReason: 'payoff',
      });
      loan.closedAt = appliedPayoffDate;

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

  /**
   * Annul the nearest pending or overdue installment.
   * Only the nearest cancellable installment can be annulled (accounting integrity rule).
   */
  const annulInstallment = async ({ loanId, actor, reason, installmentNumber = null, paymentDate = clock() }) => {
    if (actor?.role !== 'admin') {
      throw new AuthorizationError('Only admins can annul installments');
    }

    return sequelizeInstance.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction, lock: true });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      const cancellableLoanStatuses = new Set(['pending', 'active', 'overdue', 'defaulted']);
      if (!cancellableLoanStatuses.has(loan.status)) {
        throw new ValidationError('Cannot annul installments on a loan with status: ' + loan.status);
      }

      const normalizedPaymentDate = normalizePaymentDate(paymentDate);
      const { schedule: canonicalSchedule } = loanViewService.getCanonicalLoanView(loan);
      const schedule = normalizeScheduleStatuses(cloneSchedule(canonicalSchedule), normalizedPaymentDate);

      const requestedInstallmentNumber = installmentNumber === null || installmentNumber === undefined
        ? null
        : Number(installmentNumber);

      if (requestedInstallmentNumber !== null && (!Number.isInteger(requestedInstallmentNumber) || requestedInstallmentNumber <= 0)) {
        throw new ValidationError('installmentNumber must be a positive integer when provided');
      }

      // Find the nearest cancellable installment
      // Must be pending or overdue, not already paid, partial, or annulled
      const nearestCancellableRow = schedule.find((row) => {
        const outstanding = (row.remainingPrincipal || 0) + (row.remainingInterest || 0);
        return outstanding > 0 && CANCELLABLE_STATUSES.has(row.status);
      });

      if (!nearestCancellableRow) {
        throw new ValidationError('No cancellable installments found. All installments may already be paid or annulled.');
      }

      let cancellableRow = nearestCancellableRow;

      if (requestedInstallmentNumber !== null) {
        const requestedRow = schedule.find((row) => Number(row.installmentNumber) === requestedInstallmentNumber);

        if (!requestedRow) {
          throw new ValidationError(`Installment #${requestedInstallmentNumber} does not exist for this loan`);
        }

        if (requestedRow.status === 'annulled') {
          throw new ValidationError(`Installment #${requestedInstallmentNumber} is already annulled`);
        }

        const requestedOutstanding = roundCurrency((requestedRow.remainingPrincipal || 0) + (requestedRow.remainingInterest || 0));
        if (requestedOutstanding <= 0 || requestedRow.status === 'paid') {
          throw new ValidationError(`Installment #${requestedInstallmentNumber} is already paid and cannot be annulled`);
        }

        if (!CANCELLABLE_STATUSES.has(requestedRow.status)) {
          throw new ValidationError(`Installment #${requestedInstallmentNumber} cannot be annulled because it is in status '${requestedRow.status}'. Only pending or overdue installments can be annulled.`);
        }

        if (Number(requestedRow.installmentNumber) !== Number(nearestCancellableRow.installmentNumber)) {
          throw new ValidationError(`Cannot annul installment #${requestedInstallmentNumber}. Only the nearest pending or overdue installment (#${nearestCancellableRow.installmentNumber}) can be annulled.`);
        }

        cancellableRow = requestedRow;
      }

      // Validate this is the nearest one (no paid/partial installments before it)
      const rowIndex = schedule.findIndex((r) => r.installmentNumber === cancellableRow.installmentNumber);
      const hasEarlierNonCancelled = schedule.slice(0, rowIndex).some((row) => {
        const outstanding = (row.remainingPrincipal || 0) + (row.remainingInterest || 0);
        return outstanding > 0 && row.status !== 'annulled' && !CANCELLABLE_STATUSES.has(row.status);
      });

      if (hasEarlierNonCancelled) {
        throw new ValidationError('Cannot annul this installment. Only the nearest pending or overdue installment can be annulled.');
      }

      const previousStatus = cancellableRow.status;

      // Mark installment as annulled
      cancellableRow.status = 'annulled';
      cancellableRow.paidPrincipal = 0;
      cancellableRow.paidInterest = 0;
      cancellableRow.paidTotal = 0;
      // Keep remaining amounts as-is (the debt is cancelled, not redistributed)

      const snapshot = buildSnapshot(schedule);

      // Check if this was the last active installment
      const hasActiveRemaining = schedule.some((row) => {
        const outstanding = (row.remainingPrincipal || 0) + (row.remainingInterest || 0);
        return outstanding > 0 && row.status !== 'annulled';
      });

      persistLoanSnapshot({
        loan,
        snapshot,
        schedule,
        paymentDate: normalizedPaymentDate,
        closeLoan: !hasActiveRemaining,
        closureReason: !hasActiveRemaining ? 'annulled' : null,
      });

      // If loan is now closed, set appropriate status
      if (!hasActiveRemaining) {
        loan.status = 'cancelled';
        loan.closureReason = 'annulled';
        loan.closedAt = normalizedPaymentDate;
      }

      await loan.save({ transaction });

      // Record the annulment as a special payment record
      const payment = await paymentModel.create({
        loanId: loan.id,
        amount: 0,
        paymentDate: normalizedPaymentDate,
        status: 'annulled',
        paymentType: INSTALLMENT_PAYMENT_TYPE,
        principalApplied: 0,
        interestApplied: 0,
        overpaymentAmount: 0,
        remainingBalanceAfterPayment: snapshot.outstandingBalance,
        allocationBreakdown: [{
          installmentNumber: cancellableRow.installmentNumber,
          action: 'annulled',
          previousStatus,
        }],
        paymentMetadata: {
          annulment: {
            installmentNumber: cancellableRow.installmentNumber,
            annulledBy: actor.id,
            annulledAt: normalizedPaymentDate.toISOString(),
            reason: reason ? String(reason).trim() : null,
          },
        },
        installmentNumber: cancellableRow.installmentNumber,
        annulledFromInstallment: cancellableRow.installmentNumber,
      }, { transaction });

      return {
        payment,
        loan,
        annulment: {
          installmentNumber: cancellableRow.installmentNumber,
          remainingBalance: snapshot.outstandingBalance,
          loanClosed: !hasActiveRemaining,
        },
      };
    });
  };

  /**
   * Update the payment method of an existing non-reconciled payment.
   * Only admins can update payment methods.
   */
  const updatePaymentMethod = async ({ loanId, paymentId, paymentMethod, actor }) => {
    if (actor?.role !== 'admin') {
      throw new AuthorizationError('Only admins can update payment methods');
    }

    if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ValidationError(`Invalid payment method. Must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
    }

    return sequelizeInstance.transaction(async (transaction) => {
      const payment = await paymentModel.findOne({
        where: { id: paymentId, loanId },
        transaction,
      });

      if (!payment) {
        throw new NotFoundError('Payment');
      }

      if (payment.status === 'reconciled') {
        throw new ValidationError('Cannot update payment method for reconciled payments');
      }

      payment.paymentMethod = paymentMethod;
      await payment.save({ transaction });

      return payment;
    });
  };

  const generateIdempotencyKey = (loanId, paymentAmount, paymentDate) => {
    const hash = crypto.createHash('sha256');
    hash.update(`${loanId}:${paymentAmount}:${paymentDate}`);
    return hash.digest('hex').substring(0, 64);
  };

  const validateProcessPaymentInput = ({ loanId, paymentAmount, paymentDate }) => {
    if (!loanId) {
      throw new ValidationError('loanId is required');
    }
    if (!paymentAmount || paymentAmount === '0') {
      throw new ValidationError('paymentAmount must be greater than 0');
    }
    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new ValidationError('paymentAmount must be a valid number greater than 0');
    }
    if (!paymentDate) {
      throw new ValidationError('paymentDate is required');
    }
    const parsedDate = new Date(paymentDate);
    if (isNaN(parsedDate.getTime())) {
      throw new ValidationError('paymentDate must be a valid date');
    }
  };

  /**
   * Retry a transaction with exponential backoff for serialization failures.
   * PostgreSQL SERIALIZABLE may abort transactions with 40001 (serialization_failure)
   * or 40P01 (deadlock_detected). We retry up to MAX_RETRIES with jitter.
   */
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 50;

  const isRetryableTransactionError = (error) => {
    if (!error) return false;
    // Sequelize wraps PostgreSQL errors; check original error code
    const pgError = error.original || error.parent || error;
    const retryableCodes = ['40001', '40P01'];
    return retryableCodes.includes(pgError.code) ||
      retryableCodes.includes(error.code) ||
      (error.message && /serialization|deadlock/i.test(error.message));
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const runTransactionWithRetry = async (transactionFn) => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await sequelize.transaction({
          isolationLevel: sequelize.constructor.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        }, transactionFn);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES && isRetryableTransactionError(error)) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 20);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  };

  const processPayment = async ({ loanId, paymentAmount, paymentDate, paymentMethod, actorId = 0, idempotencyKey: reqIdempotencyKey }) => {
    validateProcessPaymentInput({ loanId, paymentAmount, paymentDate });

    const idempotencyKey = reqIdempotencyKey || generateIdempotencyKey(loanId, paymentAmount, paymentDate);
    const requestHash = crypto.createHash('sha256')
      .update(`${loanId}${paymentAmount}${paymentDate}`)
      .digest('hex');

    let previousBalance;

    // Use SERIALIZABLE isolation to prevent race conditions on idempotency key handling
    // The idempotency check and payment processing are wrapped in a single atomic transaction
    // with automatic retry on serialization/deadlock failures.
    try {
      const result = await runTransactionWithRetry(async (tx) => {
      // Step 1: Try to acquire lock on idempotency key row using SELECT FOR UPDATE
      // This prevents concurrent requests from processing the same idempotency key simultaneously
      const existingKey = await IdempotencyKey.findOne({
        where: { scope: 'payment', idempotencyKey },
        transaction: tx,
        lock: true, // This generates SELECT ... FOR UPDATE
      });

      // Step 2: If key exists and is completed, return cached response (idempotent replay)
      if (existingKey && existingKey.status === 'completed') {
        // Rollback this transaction since we have nothing to do
        throw new IdempotentReplayError('Payment already processed', existingKey.responsePayload);
      }

      // Step 3: Create or update idempotency key as 'pending' before processing
      // Using upsert to handle both create and update cases atomically
      // If another concurrent request already created this key, we'll detect it below
      try {
        if (existingKey) {
          // Update existing key to pending (in case of stale pending from failed attempt)
          await IdempotencyKey.update({
            requestHash,
            responsePayload: {},
            status: 'pending',
          }, {
            where: { scope: 'payment', idempotencyKey },
            transaction: tx,
          });
        } else {
          await IdempotencyKey.create({
            scope: 'payment',
            idempotencyKey,
            requestHash,
            responsePayload: {},
            createdByUserId: actorId,
            status: 'pending',
          }, { transaction: tx });
        }
      } catch (err) {
        // Handle unique constraint violation from concurrent request
        if (err.name === 'SequelizeUniqueConstraintError') {
          // Another request already created this key - fetch and return its completed response
          const completedKey = await IdempotencyKey.findOne({
            where: { scope: 'payment', idempotencyKey },
            transaction: tx,
            lock: true,
          });

          if (completedKey && completedKey.status === 'completed') {
            throw new IdempotentReplayError('Payment already processed by another request', completedKey.responsePayload);
          }

          // If still pending from another request, wait for it to complete
          throw new ValidationError('Payment with this idempotency key is currently being processed');
        }
        throw err;
      }

      // Step 4: Process the payment using the canonical waterfall engine
      const loan = await Loan.findByPk(loanId, {
        transaction: tx,
        lock: true,
      });

      if (!loan) {
        throw new NotFoundError('Loan');
      }

      previousBalance = loan.principalOutstanding || loan.amount;
      const applied = await executeInstallmentPayment({
        loanId,
        amount: Number(paymentAmount),
        paymentDate,
        paymentMethod,
        transaction: tx,
        paymentMetadata: buildProcessPaymentMetadata({ idempotencyKey }),
      });

      const payment = applied.payment;
      const capital = applied.allocation.principalApplied;
      const interest = applied.allocation.interestApplied;
      const penalty = applied.allocation.penaltyApplied;
      const newBalance = applied.allocation.remainingBalance;

      await eventPublisher.publishAmortizationCalculatedEvent({
        loanId,
        transactionId: tx.id,
        previousBalance,
        newBalance,
        breakdown: {
          capital,
          interest,
          penalty,
        },
      }, { transaction: tx });

      // Step 5: Mark idempotency key as completed
      await IdempotencyKey.update({
        responsePayload: {
          transactionId: tx.id,
          status: 'APPLIED',
          newBalance,
          breakdown: {
            capital,
            interest,
            penalty,
          },
          paymentId: payment.id,
        },
        status: 'completed',
      }, {
        where: { scope: 'payment', idempotencyKey },
        transaction: tx,
      });

        return {
          transactionId: tx.id,
          status: 'APPLIED',
          newBalance,
          breakdown: {
            capital,
            interest,
            penalty,
          },
          paymentId: payment.id,
        };
      });

      return result;
    } catch (error) {
      if (error instanceof IdempotentReplayError) {
        return {
          ...error.cachedPayload,
          idempotent: true,
        };
      }

      throw error;
    }
  };

  return {
    applyPayment,
    applyPartialPayment,
    applyCapitalPayment,
    applyPayoff,
    annulInstallment,
    processPayment,
    updatePaymentMethod,
  };
};

module.exports = {
  createPaymentApplicationService,
  isInstallmentOverdue,
  CANCELLABLE_STATUSES,
};
