const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createCustomersRouter } = require('../src/modules/customers/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = () => (req, res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
};

const customerValidation = {
  create(req, res, next) {
    next();
  },
};

test('createCustomersRouter serves list and create contract responses', async () => {
  const calls = [];
  const customers = [
    { id: 4, name: 'Ana Customer', email: 'ana@example.com' },
    { id: 3, name: 'Luis Customer', email: 'luis@example.com' },
  ];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    useCases: {
      async listCustomers() {
        calls.push(['listCustomers']);
        return customers;
      },
      async createCustomer(payload) {
        calls.push(['createCustomer', payload]);
        return {
          id: 5,
          ...payload,
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const createPayload = {
    name: 'New Customer',
    email: 'new@example.com',
    phone: '+573001112244',
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
    body: createPayload,
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    data: customers,
    message: 'Customers retrieved successfully',
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    data: {
      id: 5,
      name: 'New Customer',
      email: 'new@example.com',
      phone: '+573001112244',
    },
    message: 'Customer created successfully',
  });
  assert.deepEqual(calls, [
    ['listCustomers'],
    ['createCustomer', createPayload],
  ]);
});
