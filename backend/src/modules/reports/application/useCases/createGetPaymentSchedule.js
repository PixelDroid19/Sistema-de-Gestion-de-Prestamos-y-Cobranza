const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const { buildAmortizationSchedule } = require('@/modules/credits/application/creditFormulaHelpers');

/**
 * Get the payment schedule (amortization) for a specific credit/loan.
 * @param {object} dependencies
 * @returns {object} use case
 */
const createGetPaymentSchedule = ({ loanAccessPolicy }) => async ({ actor, loanId }) => {
  // Allow admin, customer, and socio roles to access payment schedule
  const allowedRoles = ['admin', 'customer', 'socio'];
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

  // Calculate summary
  const totalPrincipal = schedule.reduce((sum, entry) => sum + Number(entry.principalComponent || entry.principal || 0), 0);
  const totalInterest = schedule.reduce((sum, entry) => sum + Number(entry.interestComponent || entry.interest || 0), 0);
  const totalPayment = schedule.reduce((sum, entry) => sum + Number(entry.scheduledPayment || entry.payment || 0), 0);

  // Get payments made for this loan to determine which installments are paid
  const payments = await Payment.findAll({
    where: { loanId: loan.id, status: 'completed' },
    order: [['paymentDate', 'ASC'], ['createdAt', 'ASC']],
  });

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
        totalPrincipal: totalPrincipal.toFixed(2),
        totalInterest: totalInterest.toFixed(2),
        totalPayment: totalPayment.toFixed(2),
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
};
