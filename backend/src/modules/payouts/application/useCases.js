const { AuthorizationError } = require('../../../utils/errorHandler');

const createListPayments = ({ paymentRepository }) => async ({ actor }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can access all payments');
  }

  return paymentRepository.list();
};

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

const createListPaymentsByLoan = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  return paymentRepository.listByLoan(loan.id);
};

module.exports = {
  createListPayments,
  createCreatePayment,
  createListPaymentsByLoan,
};
