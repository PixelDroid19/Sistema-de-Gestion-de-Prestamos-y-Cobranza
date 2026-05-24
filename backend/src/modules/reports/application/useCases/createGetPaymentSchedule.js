const { buildAmortizationSchedule } = require('@/modules/credits/application/creditFormulaHelpers');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Build operator-facing totals for a payment schedule.
 *
 * Capital prepayments rebuild the pending schedule, so their principal no longer
 * appears in future installment rows. The summary still has to include them as
 * recovered principal, otherwise the plan shows less capital than the original
 * credit after an "abono a capital".
 *
 * @param {Array<object>} schedule Canonical amortization rows.
 * @param {Array<object>} payments Completed loan payments.
 * @returns {{ totalPrincipal: number, totalInterest: number, totalPayment: number, capitalPrepayments: number }}
 */
const summarizePaymentSchedule = ({ schedule, payments }) => {
  const schedulePrincipal = schedule.reduce(
    (sum, entry) => sum + toNumber(entry.principalComponent || entry.principal),
    0
  );
  const totalInterest = schedule.reduce(
    (sum, entry) => sum + toNumber(entry.interestComponent || entry.interest),
    0
  );
  const scheduledPaymentTotal = schedule.reduce(
    (sum, entry) => sum + toNumber(entry.scheduledPayment || entry.payment),
    0
  );
  const capitalPrepayments = payments
    .filter((payment) => payment.paymentType === 'capital')
    .reduce((sum, payment) => sum + toNumber(payment.principalApplied || payment.amount), 0);

  return {
    totalPrincipal: schedulePrincipal + capitalPrepayments,
    totalInterest,
    totalPayment: scheduledPaymentTotal + capitalPrepayments,
    capitalPrepayments,
  };
};

/**
 * Get the payment schedule (amortization) for a specific credit/loan.
 * @param {{ loanAccessPolicy: { findAuthorizedLoan: Function }, paymentRepository: { listByLoan: Function } }} dependencies
 * @returns {Function} use case
 */
const createGetPaymentSchedule = ({ loanAccessPolicy, paymentRepository }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const storedSchedule = loan.emiSchedule && Array.isArray(loan.emiSchedule) && loan.emiSchedule.length > 0
    ? loan.emiSchedule
    : null;

  const schedule = storedSchedule || buildAmortizationSchedule({
    amount: loan.amount,
    interestRate: loan.interestRate,
    termMonths: loan.termMonths,
    startDate: loan.startDate,
  });

  const payments = (await paymentRepository.listByLoan(loan.id))
    .filter((payment) => payment.status === 'completed');

  const summary = summarizePaymentSchedule({ schedule, payments });

  const scheduleWithPaymentStatus = schedule.map((entry, index) => {
    const installmentNumber = entry.installmentNumber || entry.period || (index + 1);
    const matchingPayment = payments.find((p) => p.installmentNumber === installmentNumber);

    return {
      ...entry,
      status: matchingPayment ? 'paid' : (entry.status || 'pending'),
      paidAmount: matchingPayment ? matchingPayment.amount : null,
      paidDate: matchingPayment ? matchingPayment.paymentDate : null,
      paymentId: matchingPayment ? matchingPayment.id : null,
    };
  });

  // Count paid and pending installments
  const paidCount = scheduleWithPaymentStatus.filter((e) => e.status === 'paid').length;
  const pendingCount = scheduleWithPaymentStatus.filter((e) => e.status === 'pending').length;

  return {
    success: true,
    data: {
      loan: {
        id: loan.id,
        customerId: loan.customerId,
        customerName: loan.Customer?.name || loan.customer?.name || null,
        amount: loan.amount,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        startDate: loan.startDate,
        status: loan.status,
        installmentAmount: loan.installmentAmount,
      },
      summary: {
        totalPrincipal: summary.totalPrincipal.toFixed(2),
        totalInterest: summary.totalInterest.toFixed(2),
        totalPayment: summary.totalPayment.toFixed(2),
        capitalPrepayments: summary.capitalPrepayments.toFixed(2),
        paidInstallments: paidCount,
        pendingInstallments: pendingCount,
        totalInstallments: schedule.length,
      },
      schedule: scheduleWithPaymentStatus,
    },
  };
};

module.exports = {
  createGetPaymentSchedule,
  summarizePaymentSchedule,
};
