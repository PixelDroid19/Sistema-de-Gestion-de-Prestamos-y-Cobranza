const { Op, fn, col, literal } = require('sequelize');
const {
  Loan,
  Customer,
  FinancialProduct,
  Payment,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  Notification,
  OperatingExpense,
  AssociateContribution,
  AssociateInstallment,
  Associate,
  ProfitDistribution,
  User,
} = require('@/models');
const { paginateModel } = require('@/modules/shared/pagination');

const toPlainRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

const reportIncludes = [
  {
    model: Customer,
    attributes: ['id', 'name', 'email', 'phone'],
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

const normalizeSequelizeWhereOperators = (where = {}) => {
  const normalizedWhere = { ...where };
  if (normalizedWhere.paymentDate && typeof normalizedWhere.paymentDate === 'object') {
    const paymentDate = normalizedWhere.paymentDate;
    normalizedWhere.paymentDate = {
      ...(paymentDate.gte ? { [Op.gte]: paymentDate.gte } : {}),
      ...(paymentDate.lte ? { [Op.lte]: paymentDate.lte } : {}),
    };
  }

  return normalizedWhere;
};

const TOTAL_PAYMENT_EARNINGS_LITERAL = literal('"principalApplied" + "interestApplied" + "penaltyApplied"');

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
  listCreditLoans() {
    return Loan.findAll({
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
    const [loans, payments, alerts, promises, recentNotifications, totalCustomers, operatingExpenses, associateInstallments, associateContributions, associateDistributions] = await Promise.all([
      Loan.findAll({ include: reportIncludes, order: [['updatedAt', 'DESC']] }),
      Payment.findAll({ order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']] }),
      LoanAlert.findAll({ where: { status: 'active' }, order: [['dueDate', 'ASC'], ['createdAt', 'DESC']], limit: 10 }),
      PromiseToPay.findAll({ where: { status: { [Op.in]: ['pending', 'broken'] } }, order: [['promisedDate', 'ASC'], ['createdAt', 'DESC']], limit: 10 }),
      Notification.findAll({ include: [{ model: User, attributes: ['id', 'name', 'email', 'role'] }], order: [['createdAt', 'DESC']], limit: 10 }),
      Customer.count(),
      OperatingExpense.findAll({ where: { status: 'completed' }, order: [['expenseDate', 'DESC'], ['createdAt', 'DESC']], limit: 5000 }),
      AssociateInstallment.findAll({ order: [['dueDate', 'DESC'], ['createdAt', 'DESC']], limit: 5000 }),
      AssociateContribution.findAll({ order: [['contributionDate', 'DESC'], ['createdAt', 'DESC']], limit: 5000 }),
      ProfitDistribution.findAll({ order: [['distributionDate', 'DESC'], ['createdAt', 'DESC']], limit: 5000 }),
    ]);

    return {
      loans,
      payments,
      alerts,
      promises,
      notifications: recentNotifications,
      totalCustomers,
      operatingExpenses,
      associateContributions,
      associateCapitalReturns: associateDistributions.filter((distribution) => {
        const row = toPlainRecord(distribution);
        return row?.basis?.type === 'capital-return';
      }),
      associateReinvestments: associateDistributions.filter((distribution) => toPlainRecord(distribution)?.basis?.type === 'reinvestment'),
      associateObligations: associateInstallments.filter((installment) => ['pending', 'overdue'].includes(toPlainRecord(installment).status)),
      associatePayments: [
        ...associateInstallments.filter((installment) => toPlainRecord(installment).status === 'paid'),
        ...associateDistributions.filter((distribution) => {
          const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;
          return !['reinvestment', 'capital-return'].includes(serializedDistribution?.basis?.type);
        }),
      ],
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
  /**
   * Get monthly earnings aggregation for a given year.
   * Groups completed payments by month and calculates totals.
   * @param {number} year - The year to aggregate
   * @returns {Promise<Array<{month: string, totalEarnings: number, totalInterest: number, totalPenalties: number, paymentCount: number}>>}
   */
  async getMonthlyEarnings(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const payments = await Payment.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'month', col('paymentDate')), 'month'],
        [fn('SUM', TOTAL_PAYMENT_EARNINGS_LITERAL), 'totalEarnings'],
        [fn('SUM', col('interestApplied')), 'totalInterest'],
        [fn('SUM', col('penaltyApplied')), 'totalPenalties'],
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
      totalInterest: parseFloat(p.totalInterest) || 0,
      totalPenalties: parseFloat(p.totalPenalties) || 0,
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
          [fn('SUM', TOTAL_PAYMENT_EARNINGS_LITERAL), 'totalAmount'],
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

  /**
   * List canonical records used to reconcile monthly cash flow.
   * Inflows are completed customer payments. Outflows are disbursed loan principal
   * canonical paid associate movements, and completed operating expenses.
   * @param {{year: number, fromDate?: Date|null, toDate?: Date|null}} options
   * @returns {Promise<{loans: Array<object>, payments: Array<object>, associatePayments: Array<object>, operatingExpenses: Array<object>}>}
   */
  async listCashFlowDataset({ year, fromDate = null, toDate = null }) {
    const startDate = fromDate || new Date(year, 0, 1);
    const endDate = toDate || new Date(year, 11, 31, 23, 59, 59, 999);

    const [loans, payments, paidAssociateInstallments, associateContributions, associateDistributions, operatingExpenses] = await Promise.all([
      Loan.findAll({
        where: {
          [Op.and]: [
            { status: { [Op.in]: ['approved', 'active', 'overdue', 'paid', 'closed', 'defaulted'] } },
            {
              [Op.or]: [
                { startDate: { [Op.gte]: startDate, [Op.lte]: endDate } },
                {
                  [Op.and]: [
                    { startDate: null },
                    { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } },
                  ],
                },
              ],
            },
          ],
        },
        include: reportIncludes,
        order: [['startDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      Payment.findAll({
        where: {
          status: 'completed',
          paymentDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        include: [
          {
            model: Loan,
            attributes: ['id', 'amount', 'status', 'customerId'],
            include: [{ model: Customer, attributes: ['id', 'name', 'email', 'phone'] }],
          },
        ],
        order: [['paymentDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      AssociateInstallment.findAll({
        where: {
          status: 'paid',
          paidAt: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        include: [
          {
            model: Associate,
            attributes: ['id', 'name', 'email', 'phone'],
          },
          {
            model: User,
            as: 'paidByUser',
            attributes: ['id', 'name', 'email', 'role'],
          },
        ],
        order: [['paidAt', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      AssociateContribution.findAll({
        where: {
          status: 'completed',
          contributionDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        include: [{ model: Associate, attributes: ['id', 'name', 'email', 'phone'] }],
        order: [['contributionDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      ProfitDistribution.findAll({
        where: {
          distributionDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        include: [
          {
            model: Associate,
            attributes: ['id', 'name', 'email', 'phone'],
          },
          {
            model: User,
            as: 'createdBy',
            attributes: ['id', 'name', 'email', 'role'],
          },
        ],
        order: [['distributionDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      OperatingExpense.findAll({
        where: {
          status: 'completed',
          expenseDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
        include: [
          {
            model: User,
            as: 'createdBy',
            attributes: ['id', 'name', 'email', 'role'],
          },
        ],
        order: [['expenseDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
    ]);

    return {
      loans,
      payments,
      associateContributions,
      associateReinvestments: associateDistributions.filter((distribution) => toPlainRecord(distribution)?.basis?.type === 'reinvestment'),
      associateCapitalReturns: associateDistributions.filter((distribution) => toPlainRecord(distribution)?.basis?.type === 'capital-return'),
      associatePayments: [
        ...paidAssociateInstallments,
        ...associateDistributions.filter((distribution) => {
          const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;
          return !['reinvestment', 'capital-return'].includes(serializedDistribution?.basis?.type);
        }),
      ],
      operatingExpenses,
    };
  },

  /**
   * List operating expenses for operator-facing financial exports.
   * Includes both completed and annulled records when no status filter is used.
   * @param {{fromDate?: Date|null, toDate?: Date|null, status?: string|null, employeeId?: number|null}} filters
   * @returns {Promise<Array<object>>}
   */
  listOperatingExpensesForReport({
    fromDate = null,
    toDate = null,
    status = null,
    employeeId = null,
  } = {}) {
    const expenseDate = {};
    if (fromDate) {
      expenseDate[Op.gte] = fromDate;
    }
    if (toDate) {
      expenseDate[Op.lte] = toDate;
    }

    return OperatingExpense.findAll({
      where: {
        ...(status ? { status } : {}),
        ...(employeeId ? { createdByUserId: employeeId } : {}),
        ...(Object.keys(expenseDate).length > 0 ? { expenseDate } : {}),
      },
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email', 'role'],
        },
        {
          model: User,
          as: 'annulledBy',
          attributes: ['id', 'name', 'email', 'role'],
        },
      ],
      order: [['expenseDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    });
  },

  /**
   * List canonical loans and completed payments for the advanced credit-history audit export.
   * Loans are filtered by operational credit date; payments are filtered by payment date and,
   * when a status filter is provided, by the current loan state attached to the payment.
   *
   * @param {{startDate?: Date|null, endDate?: Date|null, status?: string[]|null, customerId?: number|null, loanId?: number|null, financialProductId?: string|null}} filters
   * @returns {Promise<{loans: Array<object>, payments: Array<object>}>}
   */
  async listCreditHistoryDataset({
    startDate = null,
    endDate = null,
    status = null,
    customerId = null,
    loanId = null,
    financialProductId = null,
  } = {}) {
    const loanDateRange = {};
    if (startDate) {
      loanDateRange[Op.gte] = startDate;
    }
    if (endDate) {
      loanDateRange[Op.lte] = endDate;
    }

    const paymentDateRange = buildPaymentDateWhere({ fromDate: startDate, toDate: endDate });
    const statusWhere = Array.isArray(status) && status.length > 0
      ? {
        [Op.or]: [
          { status: { [Op.in]: status } },
          { recoveryStatus: { [Op.in]: status } },
        ],
      }
      : {};
    const loanDateWhere = Object.keys(loanDateRange).length > 0
      ? {
        [Op.or]: [
          { startDate: loanDateRange },
          { createdAt: loanDateRange },
        ],
      }
      : {};
    const loanIdentityWhere = {
      ...(customerId ? { customerId } : {}),
      ...(loanId ? { id: loanId } : {}),
      ...(financialProductId ? { financialProductId } : {}),
    };

    const operatingExpenseDateWhere = {};
    if (startDate) {
      operatingExpenseDateWhere[Op.gte] = startDate;
    }
    if (endDate) {
      operatingExpenseDateWhere[Op.lte] = endDate;
    }

    const [loans, payments, operatingExpenses] = await Promise.all([
      Loan.findAll({
        where: {
          ...statusWhere,
          ...loanDateWhere,
          ...loanIdentityWhere,
        },
        include: reportIncludes,
        order: [['startDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      Payment.findAll({
        where: {
          status: 'completed',
          ...(Object.keys(paymentDateRange).length > 0 ? { paymentDate: paymentDateRange } : {}),
        },
        include: [
          {
            model: Loan,
            attributes: ['id', 'amount', 'status', 'recoveryStatus', 'customerId'],
            where: {
              ...statusWhere,
              ...loanIdentityWhere,
            },
            include: [{ model: Customer, attributes: ['id', 'name', 'email', 'phone'] }],
          },
        ],
        order: [['paymentDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
      OperatingExpense.findAll({
        where: {
          status: 'completed',
          ...(startDate || endDate ? { expenseDate: operatingExpenseDateWhere } : {}),
        },
        order: [['expenseDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      }),
    ]);

    return { loans, payments, operatingExpenses };
  },

  /**
   * List financial products that are already associated with at least one loan
   * so report filters only expose canonical, usable credit types.
   *
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async listCreditHistoryFinancialProducts() {
    const rows = await Loan.findAll({
      attributes: ['financialProductId'],
      where: {
        financialProductId: {
          [Op.ne]: null,
        },
      },
      include: [{
        model: FinancialProduct,
        as: 'financialProduct',
        attributes: ['id', 'name'],
        required: true,
      }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });

    const seen = new Set();
    const products = [];

    rows.forEach((row) => {
      const loan = toPlainRecord(row);
      const product = loan.financialProduct;
      const productId = String(product?.id || '').trim();
      const productName = String(product?.name || '').trim();

      if (!productId || !productName || seen.has(productId)) {
        return;
      }

      seen.add(productId);
      products.push({
        id: productId,
        name: productName,
      });
    });

    return products.sort((left, right) => left.name.localeCompare(right.name, 'es'));
  },
};

/**
 * Repository contract for report-oriented payment history lookups.
 */
const paymentRepository = {
  listByLoan(loanId) {
    return Payment.findAll({
      where: { loanId },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
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
      where: normalizeSequelizeWhereOperators(where),
      include: [
        {
          model: Loan,
          attributes: ['id', 'amount', 'status', 'customerId', 'financialSnapshot'],
          include: [{ model: Customer, attributes: ['id', 'name', 'email', 'phone'] }],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email', 'role'],
          required: false,
        },
      ],
      order: [['paymentDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
    };

    if (pagination) {
      const { paginateModel } = require('@/modules/shared/pagination');
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
