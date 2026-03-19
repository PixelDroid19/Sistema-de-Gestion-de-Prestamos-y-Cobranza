const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createListCustomers,
  createCreateCustomer,
} = require('../src/modules/customers/application/useCases');

test('createListCustomers returns repository results in descending business order', async () => {
  const listCustomers = createListCustomers({
    customerRepository: {
      async list() {
        return [{ id: 4 }, { id: 3 }];
      },
    },
  });

  const customers = await listCustomers();
  assert.deepEqual(customers, [{ id: 4 }, { id: 3 }]);
});

test('createCreateCustomer delegates persistence to the repository', async () => {
  const createCustomer = createCreateCustomer({
    customerRepository: {
      async create(payload) {
        return { id: 10, ...payload };
      },
    },
  });

  const customer = await createCustomer({
    name: 'New Customer',
    email: 'new@example.com',
    phone: '+573001112244',
  });

  assert.equal(customer.id, 10);
  assert.equal(customer.email, 'new@example.com');
});
