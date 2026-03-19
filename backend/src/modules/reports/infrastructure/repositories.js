const { Op } = require('sequelize');
const {
  Loan,
  Customer,
  Agent,
  Associate,
  Payment,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  Notification,
  AssociateContribution,
  ProfitDistribution,
  User,
} = require('../../../models');

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
    attributes: ['id', 'name', 'email', 'phone', 'status', 'participationPercentage'],
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
  async getDashboardSummary() {
    const [loans, payments, alerts, promises, recentNotifications] = await Promise.all([
      Loan.findAll({ include: reportIncludes, order: [['updatedAt', 'DESC']] }),
      Payment.findAll({ order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']], limit: 10 }),
      LoanAlert.findAll({ where: { status: 'active' }, order: [['dueDate', 'ASC'], ['createdAt', 'DESC']], limit: 10 }),
      PromiseToPay.findAll({ where: { status: { [Op.in]: ['pending', 'broken'] } }, order: [['promisedDate', 'ASC'], ['createdAt', 'DESC']], limit: 10 }),
      Notification.findAll({ include: [{ model: User, attributes: ['id', 'name', 'email', 'role'] }], order: [['createdAt', 'DESC']], limit: 10 }),
    ]);

    return {
      loans,
      payments,
      alerts,
      promises,
      notifications: recentNotifications,
    };
  },
  async getCustomerHistory(customerId) {
    const [customer, loans, documents, notifications] = await Promise.all([
      Customer.findByPk(customerId),
      Loan.findAll({
        where: { customerId },
        include: reportIncludes,
        order: [['createdAt', 'DESC']],
      }),
      DocumentAttachment.findAll({
        where: { customerId },
        include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'role'] }],
        order: [['createdAt', 'DESC']],
      }),
      Notification.findAll({
        include: [{ model: User, attributes: ['id', 'name', 'email', 'role'] }],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const loanIds = loans.map((loan) => loan.id);
    const [payments, alerts, promises, loanDocuments] = loanIds.length > 0
      ? await Promise.all([
        Payment.findAll({ where: { loanId: { [Op.in]: loanIds } }, order: [['paymentDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']] }),
        LoanAlert.findAll({ where: { loanId: { [Op.in]: loanIds } }, order: [['dueDate', 'DESC'], ['createdAt', 'DESC']] }),
        PromiseToPay.findAll({
          where: { loanId: { [Op.in]: loanIds } },
          include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
          order: [['promisedDate', 'DESC'], ['createdAt', 'DESC']],
        }),
        DocumentAttachment.findAll({
          where: { loanId: { [Op.in]: loanIds } },
          include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'role'] }],
          order: [['createdAt', 'DESC']],
        }),
      ])
      : [[], [], [], []];

    return {
      customer,
      loans,
      payments,
      alerts,
      promises,
      documents: [...documents, ...loanDocuments],
      notifications: notifications.filter((notification) => Number(notification.payload?.customerId) === Number(customerId)),
    };
  },
  async getAssociateExportDataset(associateId) {
    const [associate, contributions, distributions, loans] = await Promise.all([
      Associate.findByPk(associateId),
      AssociateContribution.findAll({ where: { associateId }, order: [['contributionDate', 'DESC'], ['createdAt', 'DESC']] }),
      ProfitDistribution.findAll({ where: { associateId }, order: [['distributionDate', 'DESC'], ['createdAt', 'DESC']] }),
      Loan.findAll({ where: { associateId }, include: reportIncludes, order: [['createdAt', 'DESC']] }),
    ]);

    return {
      associate,
      contributions,
      distributions,
      loans,
    };
  },
};

/**
 * Repository contract for report-oriented payment history lookups.
 */
const paymentRepository = {
  listByLoan(loanId) {
    return Payment.findAll({
      where: { loanId },
      order: [['paymentDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    });
  },
};

module.exports = {
  reportRepository,
  paymentRepository,
};
