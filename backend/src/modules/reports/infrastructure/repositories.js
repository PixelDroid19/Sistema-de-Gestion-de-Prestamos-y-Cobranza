const { Op } = require('sequelize');
const { Loan, Customer, Agent, Associate, Payment } = require('../../../models');

const reportIncludes = [
  {
    model: Customer,
    attributes: ['id', 'name', 'email', 'phone'],
  },
  {
    model: Agent,
    attributes: ['id', 'name', 'email', 'phone'],
  },
  {
    model: Associate,
    attributes: ['id', 'name', 'email', 'phone', 'status'],
  },
];

/**
 * Repository contract for report-oriented loan queries with shared related models included.
 */
const reportRepository = {
  listRecoveredLoans() {
    return Loan.findAll({
      where: { status: 'closed' },
      include: reportIncludes,
      order: [['updatedAt', 'DESC']],
    });
  },
  listOutstandingLoans() {
    return Loan.findAll({
      where: {
        status: { [Op.in]: ['approved', 'active', 'defaulted', 'closed'] },
      },
      include: reportIncludes,
      order: [['updatedAt', 'DESC']],
    });
  },
  listRecoveryLoans() {
    return Loan.findAll({
      where: {
        status: { [Op.in]: ['approved', 'active', 'defaulted', 'closed'] },
      },
      include: reportIncludes,
      order: [['updatedAt', 'DESC']],
    });
  },
};

/**
 * Repository contract for report-oriented payment history lookups.
 */
const paymentRepository = {
  listByLoan(loanId) {
    return Payment.findAll({
      where: { loanId },
      order: [['paymentDate', 'ASC']],
    });
  },
};

module.exports = {
  reportRepository,
  paymentRepository,
};
