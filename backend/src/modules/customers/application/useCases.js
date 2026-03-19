/**
 * Create the use case that lists customers in repository-defined order.
 * @param {{ customerRepository: object }} dependencies
 * @returns {Function}
 */
const createListCustomers = ({ customerRepository }) => async () => customerRepository.list();

/**
 * Create the use case that persists a new customer record.
 * @param {{ customerRepository: object }} dependencies
 * @returns {Function}
 */
const createCreateCustomer = ({ customerRepository }) => async (payload) => customerRepository.create(payload);

module.exports = {
  createListCustomers,
  createCreateCustomer,
};
