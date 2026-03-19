const Customer = require('../../../models/Customer');

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
