const Customer = require('../../../models/Customer');

/**
 * Persistence port for customer list and creation workflows.
 */
const customerRepository = {
  list() {
    return Customer.findAll({ order: [['createdAt', 'DESC']] });
  },
  create(payload) {
    return Customer.create(payload);
  },
};

module.exports = {
  customerRepository,
};
