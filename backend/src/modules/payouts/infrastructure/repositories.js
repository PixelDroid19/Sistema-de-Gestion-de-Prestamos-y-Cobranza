const { Op, Sequelize } = require('sequelize');
const { Payment, Loan, Customer, DocumentAttachment, User } = require('../../../models');
const { paginateModel } = require('../../shared/pagination');

const paymentListInclude = [{
  model: Loan,
  include: [Customer],
}];

const normalizeOptionalSearchText = (value) => String(value || '').trim().toLowerCase();

const buildLowercaseLikeClause = (columnPath, searchPattern) => Sequelize.where(
  Sequelize.fn('LOWER', Sequelize.cast(Sequelize.col(columnPath), 'TEXT')),
  { [Op.like]: searchPattern },
);

/**
 * Build the DB predicate for the admin payment ledger search so pagination and
 * filtering stay aligned without loading every payment into memory first.
 * @param {{ filters?: object }} input
 * @returns {object|undefined}
 */
const buildPaymentListWhere = ({ filters = {} }) => {
  const andClauses = [];
  const normalizedStatus = normalizeOptionalSearchText(filters.status);
  const normalizedSearch = normalizeOptionalSearchText(filters.search);

  if (normalizedStatus) {
    andClauses.push({ status: normalizedStatus });
  }

  if (normalizedSearch) {
    const searchPattern = `%${normalizedSearch}%`;
    andClauses.push({
      [Op.or]: [
        buildLowercaseLikeClause('Payment.id', searchPattern),
        buildLowercaseLikeClause('Payment.loanId', searchPattern),
        buildLowercaseLikeClause('Payment.paymentMethod', searchPattern),
        buildLowercaseLikeClause('Payment.paymentType', searchPattern),
        buildLowercaseLikeClause('Loan->Customer.name', searchPattern),
        buildLowercaseLikeClause('Loan->Customer.email', searchPattern),
      ],
    });
  }

  return andClauses.length > 0 ? { [Op.and]: andClauses } : undefined;
};

/**
 * Persistence port for payment list and loan-history queries.
 */
const paymentRepository = {
  list({ filters = {} } = {}) {
    return Payment.findAll({
      where: buildPaymentListWhere({ filters }),
      include: paymentListInclude,
      order: [['createdAt', 'DESC']],
    });
  },
  listPage({ page, pageSize, filters = {} }) {
    return paginateModel({
      model: Payment,
      page,
      pageSize,
      where: buildPaymentListWhere({ filters }),
      include: paymentListInclude,
      order: [['createdAt', 'DESC']],
    });
  },
  listByLoan(loanId) {
    return Payment.findAll({ where: { loanId }, order: [['createdAt', 'DESC']] });
  },
  listPageByLoan({ loanId, page, pageSize }) {
    return paginateModel({
      model: Payment,
      page,
      pageSize,
      where: { loanId },
      order: [['createdAt', 'DESC']],
    });
  },
  findById(id) {
    return Payment.findByPk(id, { include: [Loan] });
  },
  update(payment, payload) {
    return payment.update(payload);
  },
  listDocuments(paymentId) {
    return DocumentAttachment.findAll({
      where: { paymentId },
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['createdAt', 'DESC']],
    });
  },
  findDocument({ paymentId, documentId }) {
    return DocumentAttachment.findOne({
      where: { id: documentId, paymentId },
      include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'name', 'email', 'role'] }],
    });
  },
  createDocument(payload) {
    return DocumentAttachment.create(payload);
  },
};

module.exports = {
  paymentRepository,
};
