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
