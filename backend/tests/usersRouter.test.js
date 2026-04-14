const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createUsersRouter } = require('../src/modules/users/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = (user = { id: 1, role: 'admin' }) => () => (req, res, next) => {
  req.user = user;
  next();
};

test('createUsersRouter serves list, read, update, deactivate, reactivate, and unlock contracts', async () => {
  const calls = [];
  const router = createUsersRouter({
    authMiddleware: allowAuth(),
    useCases: {
      async listUsers(input) {
        calls.push(['listUsers', input]);
        return {
          items: [{ id: 2, role: 'admin', email: 'admin2@example.com' }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        };
      },
      async getUserById(userId) {
        calls.push(['getUserById', userId]);
        return { id: Number(userId), role: 'customer', email: 'customer@example.com' };
      },
      async updateUser(userId, payload) {
        calls.push(['updateUser', userId, payload]);
        return { id: Number(userId), ...payload };
      },
      async deactivateUser(userId) {
        calls.push(['deactivateUser', userId]);
        return { id: Number(userId), isActive: false };
      },
      async reactivateUser(userId) {
        calls.push(['reactivateUser', userId]);
        return { id: Number(userId), isActive: true };
      },
      async unlockUser(userId) {
        calls.push(['unlockUser', userId]);
        return { id: Number(userId), failedLoginAttempts: 0, lockedUntil: null };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const listResponse = await requestJson(activeServer, { method: 'GET', path: '/', headers: { authorization: 'Bearer valid-token' } });
  const getResponse = await requestJson(activeServer, { method: 'GET', path: '/7', headers: { authorization: 'Bearer valid-token' } });
  const updateResponse = await requestJson(activeServer, {
    method: 'PUT',
    path: '/7',
    headers: { authorization: 'Bearer valid-token' },
    body: { role: 'admin' },
  });
  const deactivateResponse = await requestJson(activeServer, { method: 'POST', path: '/7/deactivate', headers: { authorization: 'Bearer valid-token' } });
  const reactivateResponse = await requestJson(activeServer, { method: 'POST', path: '/7/reactivate', headers: { authorization: 'Bearer valid-token' } });
  const unlockResponse = await requestJson(activeServer, { method: 'POST', path: '/7/unlock', headers: { authorization: 'Bearer valid-token' } });

  assert.equal(listResponse.statusCode, 200);
   assert.deepEqual(listResponse.body, {
    success: true,
    count: 1,
    data: {
      users: [{ id: 2, role: 'admin', email: 'admin2@example.com' }],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    },
   });
  assert.equal(getResponse.statusCode, 200);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(deactivateResponse.statusCode, 200);
  assert.equal(reactivateResponse.statusCode, 200);
  assert.equal(unlockResponse.statusCode, 200);
  assert.deepEqual(calls, [
    ['listUsers', { pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 } }],
    ['getUserById', '7'],
    ['updateUser', '7', { role: 'admin' }],
    ['deactivateUser', '7'],
    ['reactivateUser', '7'],
    ['unlockUser', '7'],
  ]);
});

test('createUsersRouter blocks self-deactivation at the HTTP contract', async () => {
  const router = createUsersRouter({
    authMiddleware: allowAuth({ id: 7, role: 'admin' }),
    useCases: {
      async listUsers() {
        throw new Error('listUsers should not be called');
      },
      async getUserById() {
        throw new Error('getUserById should not be called');
      },
      async updateUser() {
        throw new Error('updateUser should not be called');
      },
      async deactivateUser() {
        throw new Error('deactivateUser should not be called');
      },
      async reactivateUser() {
        throw new Error('reactivateUser should not be called');
      },
      async unlockUser() {
        throw new Error('unlockUser should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/7/deactivate',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'You cannot deactivate your own account');
});
