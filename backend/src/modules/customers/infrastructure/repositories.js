const Customer = require('../../../models/Customer');
const { DocumentAttachment, User } = require('../../../models');
const { paginateModel } = require('../../shared/pagination');

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
  findById(id) {
    return Customer.findByPk(id);
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
