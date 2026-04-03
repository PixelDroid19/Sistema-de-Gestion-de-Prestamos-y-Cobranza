const { Op, fn, col, literal } = require('sequelize');
const {
  Loan,
  Customer,
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
const { paginateModel } = require('../../shared/pagination');

const reportIncludes = [
  {
    model: Customer,
    attributes: ['id', 'name', 'email', 'phone'],
  },
  {
    model: Associate,
    attributes: ['id', 'name', 'email', 'phone', 'status', 'participationPercentage'],
  },
];

const buildPaymentDateWhere = ({ fromDate = null, toDate = null } = {}) => {
  const paymentDateWhere = {};

  if (fromDate) {
    paymentDateWhere[Op.gte] = fromDate;
  }

  if (toDate) {
    paymentDateWhere[Op.lte] = toDate;
  }

  return paymentDateWhere;
};

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
  listRecoveredLoansPage({ page, pageSize }) {
    return paginateModel({
      model: Loan,
      page,
      pageSize,
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
  listOutstandingLoansPage({ page, pageSize }) {
    return paginateModel({
      model: Loan,
      page,
      pageSize,
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
  listRecoveryLoansPage({ page, pageSize }) {
    return paginateModel({
      model: Loan,
      page,
      pageSize,
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
  async getCustomerCreditProfileDataset(customerId) {
    return this.getCustomerHistory(customerId);
  },
  async listProfitabilityDataset({ fromDate = null, toDate = null } = {}) {
    const paymentDateWhere = buildPaymentDateWhere({ fromDate, toDate });

    const [loans, payments] = await Promise.all([
      Loan.findAll({
        include: reportIncludes,
        order: [['createdAt', 'DESC']],
      }),
      Payment.findAll({
        where: {
          ...(Object.keys(paymentDateWhere).length > 0 ? { paymentDate: paymentDateWhere } : {}),
        },
        order: [['paymentDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      }),
    ]);

    return {
      loans,
      payments,
    };
  },
  async listLoanProfitabilityPage({ fromDate = null, toDate = null, page, pageSize }) {
    const paymentDateWhere = buildPaymentDateWhere({ fromDate, toDate });
    const loanPage = await paginateModel({
      model: Loan,
      page,
      pageSize,
      include: reportIncludes,
      order: [['createdAt', 'DESC']],
    });
    const loanIds = loanPage.items.map((loan) => loan.id);
    const payments = loanIds.length > 0
      ? await Payment.findAll({
        where: {
          loanId: { [Op.in]: loanIds },
          ...(Object.keys(paymentDateWhere).length > 0 ? { paymentDate: paymentDateWhere } : {}),
        },
        order: [['paymentDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      })
      : [];

    return {
      items: {
        loans: loanPage.items,
        payments,
      },
      pagination: loanPage.pagination,
    };
  },
  async listCustomerProfitabilityPage({ fromDate = null, toDate = null, page, pageSize }) {
    const paymentDateWhere = buildPaymentDateWhere({ fromDate, toDate });
    const customerPage = await paginateModel({
      model: Customer,
      page,
      pageSize,
      include: [{ model: Loan, attributes: [], required: true }],
      order: [['createdAt', 'DESC']],
      distinct: true,
      findOptions: { subQuery: false },
    });
    const customerIds = customerPage.items.map((customer) => customer.id);
    const loans = customerIds.length > 0
      ? await Loan.findAll({
        where: { customerId: { [Op.in]: customerIds } },
        include: reportIncludes,
        order: [['createdAt', 'DESC']],
      })
      : [];
    const loanIds = loans.map((loan) => loan.id);
    const payments = loanIds.length > 0
      ? await Payment.findAll({
        where: {
          loanId: { [Op.in]: loanIds },
          ...(Object.keys(paymentDateWhere).length > 0 ? { paymentDate: paymentDateWhere } : {}),
        },
        order: [['paymentDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      })
      : [];

    return {
      items: {
        customers: customerPage.items,
        loans,
        payments,
      },
      pagination: customerPage.pagination,
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

  /**
   * Get monthly earnings aggregation for a given year.
   * Groups completed payments by month and calculates totals.
   * @param {number} year - The year to aggregate
   * @returns {Promise<Array<{month: string, totalEarnings: number, paymentCount: number}>>}
   */
  async getMonthlyEarnings(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const payments = await Payment.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'month', col('paymentDate')), 'month'],
        [fn('SUM', literal('principalApplied + interestApplied + penaltyApplied')), 'totalEarnings'],
        [fn('COUNT', col('Payment.id')), 'paymentCount'],
      ],
      where: {
        status: 'completed',
        paymentDate: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      group: [fn('DATE_TRUNC', 'month', col('paymentDate'))],
      order: [[fn('DATE_TRUNC', 'month', col('paymentDate')), 'ASC']],
      raw: true,
    });

    return payments.map((p) => ({
      month: p.month ? new Date(p.month).toISOString().slice(0, 7) : null,
      totalEarnings: parseFloat(p.totalEarnings) || 0,
      paymentCount: parseInt(p.paymentCount, 10) || 0,
    }));
  },

  /**
   * Get performance metrics (totals, averages, counts) for a year.
   * @param {number} year - The year to aggregate
   * @returns {Promise<object>}
   */
  async getPerformanceMetrics(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const [earningsData, loansData, paymentsData] = await Promise.all([
      Payment.findAll({
        attributes: [
          [fn('SUM', literal('principalApplied + interestApplied + penaltyApplied')), 'totalAmount'],
          [fn('COUNT', col('Payment.id')), 'count'],
        ],
        where: {
          status: 'completed',
          paymentDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        raw: true,
      }),
      Loan.findAll({
        attributes: [
          [fn('COUNT', col('Loan.id')), 'totalLoans'],
          [fn('SUM', col('amount')), 'totalAmount'],
        ],
        where: {
          createdAt: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        raw: true,
      }),
      Payment.findAll({
        attributes: [
          [fn('SUM', col('interestApplied')), 'totalInterest'],
          [fn('SUM', col('penaltyApplied')), 'totalPenalties'],
        ],
        where: {
          status: 'completed',
          paymentDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        raw: true,
      }),
    ]);

    const earnings = earningsData[0] || {};
    const loans = loansData[0] || {};
    const payments = paymentsData[0] || {};

    return {
      totalEarnings: parseFloat(earnings.totalAmount) || 0,
      totalInterest: parseFloat(payments.totalInterest) || 0,
      totalPenalties: parseFloat(payments.totalPenalties) || 0,
      paymentCount: parseInt(earnings.count, 10) || 0,
      totalLoans: parseInt(loans.totalLoans, 10) || 0,
      totalLoanAmount: parseFloat(loans.totalAmount) || 0,
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

  /**
   * Sum interest applied from completed payments within a date range.
   * @param {Date|null} fromDate - Start date (inclusive)
   * @param {Date|null} toDate - End date (inclusive)
   * @returns {Promise<number>}
   */
  async sumInterest(fromDate = null, toDate = null) {
    const where = { status: 'completed' };
    if (fromDate || toDate) {
      where.paymentDate = {};
      if (fromDate) where.paymentDate[Op.gte] = fromDate;
      if (toDate) where.paymentDate[Op.lte] = toDate;
    }

    const result = await Payment.findAll({
      attributes: [[fn('SUM', col('interestApplied')), 'totalInterest']],
      where,
      raw: true,
    });

    return parseFloat(result[0]?.totalInterest) || 0;
  },

  /**
   * Get monthly interest breakdown for a given year.
   * @param {number} year - The year to aggregate
   * @returns {Promise<Array<{month: string, interest: number}>>}
   */
  async getMonthlyInterest(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const payments = await Payment.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'month', col('paymentDate')), 'month'],
        [fn('SUM', col('interestApplied')), 'interest'],
      ],
      where: {
        status: 'completed',
        paymentDate: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      group: [fn('DATE_TRUNC', 'month', col('paymentDate'))],
      order: [[fn('DATE_TRUNC', 'month', col('paymentDate')), 'ASC']],
      raw: true,
    });

    return payments.map((p) => ({
      month: p.month ? new Date(p.month).toISOString().slice(0, 7) : null,
      interest: parseFloat(p.interest) || 0,
    }));
  },

  /**
   * List all payouts (completed payments) across all loans with optional filtering and pagination.
   * @param {object} options - Query options
   * @returns {Promise<{items: Array, pagination: object|null}>}
   */
  async listPayoutsReport({ pagination, ...where }) {
    const queryOptions = {
      where,
      include: [
        { model: Loan, attributes: ['id', 'amount', 'status'] },
      ],
      order: [['paymentDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
    };

    if (pagination) {
      const { paginateModel } = require('../../shared/pagination');
      return paginateModel({
        model: Payment,
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...queryOptions,
      });
    }

    const items = await Payment.findAll(queryOptions);
    return { items };
  },
};

module.exports = {
  reportRepository,
  paymentRepository,
};
