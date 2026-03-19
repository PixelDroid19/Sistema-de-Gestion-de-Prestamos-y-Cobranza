const Payment = require('../../../models/Payment');
const Loan = require('../../../models/Loan');

/**
 * Persistence port for payment list and loan-history queries.
 */
const paymentRepository = {
  list() {
    return Payment.findAll({ include: Loan, order: [['createdAt', 'DESC']] });
  },
  listByLoan(loanId) {
    return Payment.findAll({ where: { loanId }, order: [['createdAt', 'DESC']] });
  },
};

module.exports = {
  paymentRepository,
};
