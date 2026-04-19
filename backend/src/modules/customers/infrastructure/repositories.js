const Customer = require('@/models/Customer');
const { sequelize, DocumentAttachment, Loan, User } = require('@/models');
const { paginateModel } = require('@/modules/shared/pagination');

const ACTIVE_LOAN_STATUSES = new Set(['approved', 'active', 'defaulted', 'overdue']);

const toPlainRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

const normalizeCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 100) / 100;
};

const getLoanOutstandingBalance = (loan) => {
  const snapshotOutstanding = Number(loan?.financialSnapshot?.outstandingBalance);
  if (Number.isFinite(snapshotOutstanding)) {
    return normalizeCurrency(snapshotOutstanding);
  }

  const principalOutstanding = Number(loan?.principalOutstanding);
  const interestOutstanding = Number(loan?.interestOutstanding);
  if (Number.isFinite(principalOutstanding) || Number.isFinite(interestOutstanding)) {
    return normalizeCurrency(
      (Number.isFinite(principalOutstanding) ? principalOutstanding : 0)
      + (Number.isFinite(interestOutstanding) ? interestOutstanding : 0),
    );
  }

  const totalPayable = Number(loan?.totalPayable);
  const totalPaid = Number(loan?.totalPaid);
  if (Number.isFinite(totalPayable) || Number.isFinite(totalPaid)) {
    return normalizeCurrency(Math.max((Number.isFinite(totalPayable) ? totalPayable : 0) - (Number.isFinite(totalPaid) ? totalPaid : 0), 0));
  }

  return 0;
};

const getLatestLoan = (loans) => loans.reduce((latest, current) => {
  if (!latest) {
    return current;
  }

  const latestTimestamp = new Date(latest.createdAt || 0).getTime();
  const currentTimestamp = new Date(current.createdAt || 0).getTime();

  if (currentTimestamp === latestTimestamp) {
    return Number(current.id || 0) > Number(latest.id || 0) ? current : latest;
  }

  return currentTimestamp > latestTimestamp ? current : latest;
}, null);

const buildLoanSummary = (loans = []) => {
  const activeLoans = loans.filter((loan) => ACTIVE_LOAN_STATUSES.has(String(loan.status || '').toLowerCase())).length;
  const latestLoan = getLatestLoan(loans);

  return {
    totalLoans: loans.length,
    activeLoans,
    totalOutstandingBalance: normalizeCurrency(loans.reduce((total, loan) => total + getLoanOutstandingBalance(loan), 0)),
    latestLoanId: latestLoan?.id ?? null,
    latestLoanStatus: latestLoan?.status ?? null,
  };
};

/**
 * Persistence port for customer list and creation workflows.
 */
const customerRepository = {
  list() {
    return Customer.findAll({ order: [['createdAt', 'DESC']] });
  },
  listPage({ page, pageSize }) {
    return paginateModel({
      model: Customer,
      page,
      pageSize,
      order: [['createdAt', 'DESC']],
    });
  },
  create(payload) {
    return Customer.create(payload);
  },
  async syncPrimaryKeySequence() {
    await sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"Customers"', 'id'),
        COALESCE((SELECT MAX(id) FROM "Customers"), 0),
        true
      );
    `);
  },
  async attachLoanSummaries(customers) {
    if (!Array.isArray(customers) || customers.length === 0) {
      return [];
    }

    const customerIds = [...new Set(customers.map((customer) => Number(customer?.id)).filter(Number.isFinite))];
    const loans = customerIds.length > 0
      ? await Loan.findAll({
        where: { customerId: customerIds },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      })
      : [];

    const loansByCustomerId = new Map();
    loans.forEach((loanRecord) => {
      const loan = toPlainRecord(loanRecord);
      const loanCustomerId = Number(loan.customerId);
      const entries = loansByCustomerId.get(loanCustomerId) || [];
      entries.push(loan);
      loansByCustomerId.set(loanCustomerId, entries);
    });

    return customers.map((customerRecord) => {
      const customer = toPlainRecord(customerRecord);
      const loanSummary = buildLoanSummary(loansByCustomerId.get(Number(customer.id)) || []);

      return {
        ...customer,
        loanCount: loanSummary.totalLoans,
        activeLoans: loanSummary.activeLoans,
        loanSummary,
      };
    });
  },
  findById(id) {
    return Customer.findByPk(id);
  },
  findByIdIncludingDeleted(id) {
    return Customer.findByPk(id, { paranoid: false });
  },
  restore(id) {
    return Customer.restore({ where: { id } });
  },
  findByDocumentNumber(documentNumber) {
    return Customer.findOne({ where: { documentNumber } });
  },
  update(customer, payload) {
    return customer.update(payload);
  },
  deleteById(id) {
    return Customer.destroy({ where: { id } });
  },
  listDocuments(customerId) {
    return DocumentAttachment.findAll({
      where: { customerId },
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['createdAt', 'DESC']],
    });
  },
  findDocument({ customerId, documentId }) {
    return DocumentAttachment.findOne({
      where: { id: documentId, customerId },
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'role'] }],
    });
  },
  createDocument(payload) {
    return DocumentAttachment.create(payload);
  },
  deleteDocument(documentId) {
    return DocumentAttachment.destroy({ where: { id: documentId } });
  },
};

module.exports = {
  customerRepository,
};
