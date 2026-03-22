const { Payment, Loan, DocumentAttachment, User } = require('../../../models');
const { paginateModel } = require('../../shared/pagination');

/**
 * Persistence port for payment list and loan-history queries.
 */
const paymentRepository = {
  list() {
    return Payment.findAll({ include: Loan, order: [['createdAt', 'DESC']] });
  },
  listPage({ page, pageSize }) {
    return paginateModel({
      model: Payment,
      page,
      pageSize,
      include: [Loan],
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
