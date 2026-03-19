const createListCustomers = ({ customerRepository }) => async () => customerRepository.list();

const createCreateCustomer = ({ customerRepository }) => async (payload) => customerRepository.create(payload);

module.exports = {
  createListCustomers,
  createCreateCustomer,
};
