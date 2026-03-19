const { AuthorizationError } = require('../../../utils/errorHandler');

/**
 * Create the use case that lists all payments for admins.
 * @param {{ paymentRepository: object }} dependencies
 * @returns {Function}
 */
const createListPayments = ({ paymentRepository }) => async ({ actor }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can access all payments');
  }

  return paymentRepository.list();
};

/**
 * Create the use case that applies a customer payment against an authorized loan.
 * @param {{ paymentApplicationService: object, loanAccessPolicy: object, clock?: Function }} dependencies
 * @returns {Function}
 */
const createCreatePayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount }) => {
  if (actor?.role !== 'customer') {
    throw new AuthorizationError('Only customers can create payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
  });
};

/**
 * Create the use case that lists payment history for an authorized loan.
 * @param {{ paymentRepository: object, loanAccessPolicy: object }} dependencies
 * @returns {Function}
 */
const createListPaymentsByLoan = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  return paymentRepository.listByLoan(loan.id);
};

module.exports = {
  createListPayments,
  createCreatePayment,
  createListPaymentsByLoan,
};
