const { NotFoundError, ValidationError } = require('@/utils/errorHandler');
const { buildFinancialSnapshot, normalizeUtcDateOnly } = require('@/modules/credits/application/loanFinancials');
const { addMonths, roundCurrency } = require('@/modules/credits/application/creditFormulaHelpers');
const { calculateCredit } = require('@/modules/credits/domain/calculation/creditCalculationEngine');

const CORRECTION_UNAVAILABLE = 'Solo se pueden corregir créditos abiertos sin alertas, compromisos ni anulaciones de cuotas.';
const CORRECTION_TERM_TOO_SHORT = 'El nuevo plazo debe incluir las cuotas que ya tienen pagos y al menos una cuota pendiente.';
const CORRECTION_AMOUNT_TOO_LOW = 'El nuevo monto no puede ser menor que el capital ya abonado y el comprometido en cuotas parcialmente pagadas.';
const CORRECTION_DATE_CONFLICT = 'La nueva fecha de desembolso debe ser anterior o igual a los pagos registrados y mantener las cuotas pendientes después de las ya cobradas.';

const sumMoney = (rows, field) => roundCurrency(rows.reduce((total, row) => total + Number(row[field] || 0), 0));

/** Paid installments are accounting history; only the unserviced tail is rebuilt. */
const getPreservedRowCount = (schedule) => schedule.reduce((lastCount, row, index) => (
  row.status === 'paid' || row.status === 'annulled'
  || Number(row.paidTotal || 0) > 0 || Number(row.lateFeePaid || 0) > 0
    ? index + 1
    : lastCount
), 0);

const buildCorrectedSnapshot = ({ priorSnapshot, schedule, policySnapshot, startDate, nextInstallmentAmount }) => {
  const summary = buildFinancialSnapshot(schedule);
  const capitalAdjustmentsApplied = roundCurrency(priorSnapshot.capitalAdjustmentsApplied || 0);
  const totalPaidPenalty = roundCurrency(priorSnapshot.totalPaidPenalty || 0);
  const totalPaidAccruedInterest = roundCurrency(priorSnapshot.totalPaidAccruedInterest || 0);
  const totalPaidPrincipal = roundCurrency(summary.totalPaidPrincipal + capitalAdjustmentsApplied);
  const totalPaidInterest = roundCurrency(summary.totalPaidInterest + totalPaidAccruedInterest);
  const totalPaid = roundCurrency(totalPaidPrincipal + totalPaidInterest + totalPaidPenalty);
  return {
    ...priorSnapshot,
    ...summary,
    installmentAmount: nextInstallmentAmount,
    capitalAdjustmentsApplied,
    totalPrincipal: roundCurrency(summary.totalPrincipal + capitalAdjustmentsApplied),
    totalPaidPrincipal,
    totalPaidInterest,
    totalPaidPenalty,
    totalPaidAccruedInterest,
    totalPaid,
    totalPayable: roundCurrency(totalPaid + summary.outstandingBalance),
    calculationMethod: policySnapshot.calculationMethod,
    policySnapshot,
    startDate: startDate.toISOString(),
  };
};

/** Correct future obligations under the loan lock while preserving posted receipts. */
const createLoanCorrectionService = ({ loanModel, paymentModel, alertModel, promiseModel, profileModel }) => ({
  async correct({ loanId, actorId, amount, interestRate, termMonths, startDate }) {
    return loanModel.sequelize.transaction(async (transaction) => {
      const loan = await loanModel.findByPk(loanId, { transaction, lock: true });
      if (!loan) throw new NotFoundError('Loan');

      const [payments, alerts, promises] = await Promise.all([
        paymentModel.findAll({ where: { loanId }, transaction }),
        alertModel.count({ where: { loanId }, transaction }),
        promiseModel.count({ where: { loanId }, transaction }),
      ]);
      if (!['pending', 'approved', 'active', 'overdue', 'defaulted'].includes(loan.status)
        || alerts || promises || loan.associateId != null
        || Object.keys(loan.financialBlock || {}).length > 0
        || payments.some((payment) => payment.status === 'annulled' || payment.paymentType === 'payoff')) {
        throw new ValidationError(CORRECTION_UNAVAILABLE);
      }

      const profile = await profileModel.findByPk(loan.calculationProfileVersionId, { transaction });
      if (!profile) throw new ValidationError('No se encontró el perfil de cálculo original de este crédito.');

      const selectedDate = normalizeUtcDateOnly(startDate, 'Loan start date');
      if (payments.some((payment) => payment.status === 'completed'
        && normalizeUtcDateOnly(payment.paymentDate, 'Payment date') < selectedDate)) {
        throw new ValidationError(CORRECTION_DATE_CONFLICT);
      }
      const priorPolicy = loan.policySnapshot || {};
      const policySnapshot = {
        ...priorPolicy,
        rateSource: 'manual',
        ratePolicyId: null,
        ratePolicyKey: null,
        ratePolicyLabel: null,
        ratePolicyRate: null,
        appliedInterestRate: interestRate,
      };
      const previousSchedule = Array.isArray(loan.emiSchedule) ? loan.emiSchedule : [];
      if (payments.some((payment) => payment.status === 'completed') && previousSchedule.length === 0) {
        throw new ValidationError('El crédito tiene pagos pero no conserva un calendario para conciliarlos.');
      }
      const preservedCount = getPreservedRowCount(previousSchedule);
      if (payments.some((payment) => payment.status === 'completed'
        && Number.isInteger(payment.installmentNumber)
        && payment.installmentNumber > preservedCount)) {
        throw new ValidationError('Los pagos registrados no concilian con el calendario actual; no se aplicó la corrección.');
      }
      const preservedRows = previousSchedule.slice(0, preservedCount);
      const remainingTerm = termMonths - preservedCount;
      if (remainingTerm < 1) throw new ValidationError(CORRECTION_TERM_TOO_SHORT);

      const currentFuturePrincipal = sumMoney(
        previousSchedule.slice(preservedCount).filter((row) => row.status !== 'annulled'),
        'remainingPrincipal',
      );
      const correctedFuturePrincipal = roundCurrency(currentFuturePrincipal + amount - Number(loan.amount));
      if (preservedCount > 0 && correctedFuturePrincipal <= 0) {
        throw new ValidationError(CORRECTION_AMOUNT_TOO_LOW);
      }

      // The archived profile still defines the formula version originally used.
      const frozenProfile = { ...profile.toJSON(), status: 'active' };
      const calculation = calculateCredit({
        input: {
          amount: preservedCount > 0 ? correctedFuturePrincipal : amount,
          interestRate,
          termMonths: remainingTerm,
          startDate: addMonths(selectedDate, preservedCount),
          calculationMethod: loan.calculationMethod,
          lateFeeMode: loan.lateFeeMode,
          annualLateFeeRate: Number(loan.annualLateFeeRate || 0),
        },
        profileVersion: frozenProfile,
        policySnapshot,
      });
      const futureRows = calculation.schedule.map((row, index) => ({
        ...row,
        installmentNumber: preservedCount + index + 1,
      }));
      if (preservedRows.length > 0 && futureRows.length > 0
        && normalizeUtcDateOnly(futureRows[0].dueDate, 'Schedule due date')
          <= normalizeUtcDateOnly(preservedRows.at(-1).dueDate, 'Schedule due date')) {
        throw new ValidationError(CORRECTION_DATE_CONFLICT);
      }
      const schedule = [...preservedRows, ...futureRows];
      const priorSnapshot = loan.financialSnapshot || {};
      const financialSnapshot = buildCorrectedSnapshot({
        priorSnapshot,
        schedule,
        policySnapshot: calculation.policySnapshot,
        startDate: selectedDate,
        nextInstallmentAmount: futureRows[0]?.scheduledPayment || 0,
      });
      if (Math.abs(financialSnapshot.totalPrincipal - amount) > 0.02) {
        throw new ValidationError('El capital registrado y el calendario de pagos no concilian; no se aplicó la corrección.');
      }
      financialSnapshot.correctionHistory = [
        ...(Array.isArray(priorSnapshot.correctionHistory) ? priorSnapshot.correctionHistory : []),
        {
          at: new Date().toISOString(), actorId,
          mode: preservedCount > 0 ? 'future_installments' : 'full_schedule',
          preservedInstallments: preservedCount,
          before: {
            amount: Number(loan.amount),
            interestRate: Number(loan.interestRate),
            termMonths: loan.termMonths,
            startDate: normalizeUtcDateOnly(loan.startDate, 'Loan start date').toISOString().slice(0, 10),
            rateSource: priorPolicy.rateSource || null,
            policySnapshot: priorPolicy,
          },
          after: { amount, interestRate, termMonths, startDate, rateSource: 'manual' },
        },
      ];

      loan.set({
        amount,
        interestRate,
        termMonths,
        startDate: selectedDate,
        calculationMethod: calculation.method,
        ratePolicyId: null,
        policySnapshot: calculation.policySnapshot,
        emiSchedule: schedule,
        installmentAmount: financialSnapshot.installmentAmount,
        totalPayable: financialSnapshot.totalPayable,
        totalPaid: financialSnapshot.totalPaid,
        principalOutstanding: financialSnapshot.outstandingPrincipal,
        interestOutstanding: financialSnapshot.outstandingInterest,
        financialSnapshot,
      });
      await loan.save({ transaction });
      return loan;
    });
  },
});

module.exports = { createLoanCorrectionService, CORRECTION_UNAVAILABLE };
