const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
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
 * @param {object} dependencies
 * @returns {object} use case
 */
const createGetPaymentSchedule = ({ loanAccessPolicy }) => async ({ actor, loanId }) => {
  // Allow authorized backoffice users to access payment schedules.
  const allowedRoles = ['admin', 'employee'];
  if (!allowedRoles.includes(actor.role)) {
    throw new AuthorizationError('You do not have permission to access this payment schedule');
  }

  // For customers and socios, verify they have access to this loan
  if (actor.role === 'customer' || actor.role === 'socio') {
    await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  }

  // Get the loan - we need to fetch it directly since we need its details
  const { Loan, Customer, Payment } = require('@/models');
  const loan = await Loan.findByPk(loanId, {
    include: [{ model: Customer, attributes: ['id', 'name', 'email', 'phone'] }],
  });

  if (!loan) {
    throw new NotFoundError('Loan');
  }

  // If loan already has an emiSchedule stored, use it
  const storedSchedule = loan.emiSchedule && Array.isArray(loan.emiSchedule) && loan.emiSchedule.length > 0
    ? loan.emiSchedule
    : null;

  // Build the schedule based on loan terms
  const schedule = storedSchedule || buildAmortizationSchedule({
    amount: loan.amount,
    interestRate: loan.interestRate,
    termMonths: loan.termMonths,
    startDate: loan.startDate,
  });

  // Get payments made for this loan to determine which installments are paid
  const payments = await Payment.findAll({
    where: { loanId: loan.id, status: 'completed' },
    order: [['paymentDate', 'ASC'], ['createdAt', 'ASC']],
  });

  // Calculate summary after loading payments so capital prepayments are included.
  const summary = summarizePaymentSchedule({ schedule, payments });

  // Mark installments as paid based on payments
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
        customerName: loan.Customer?.name || null,
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
