const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createReportsRouter } = require('../src/modules/reports/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const roleAwareAuth = (roles = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  if (roles.length > 0 && !roles.includes(role)) {
    res.status(403).json({ success: false, error: { message: 'Access denied', statusCode: 403 } });
    return;
  }

  req.user = { id: 1, role };
  next();
};

test('createReportsRouter serves report contract responses', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans(input) {
        calls.push(['getRecoveredLoans', input.actor.role]);
        return {
          success: true,
          count: 1,
          summary: { totalRecoveredAmount: '1200.00' },
          data: { loans: [{ id: 4 }] },
        };
      },
      async getOutstandingLoans(input) {
        calls.push(['getOutstandingLoans', input.actor.role]);
        return {
          success: true,
          count: 1,
          summary: { totalOutstandingAmount: '500.00' },
          data: { loans: [{ id: 5 }] },
        };
      },
      async getRecoveryReport(input) {
        calls.push(['getRecoveryReport', input.actor.role]);
        return {
          success: true,
          summary: { totalLoans: 2 },
          data: { recoveredLoans: [{ id: 4 }], outstandingLoans: [{ id: 5 }] },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const recoveredResponse = await requestJson(activeServer, {
    path: '/recovered',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const outstandingResponse = await requestJson(activeServer, {
    path: '/outstanding',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const recoveryResponse = await requestJson(activeServer, {
    path: '/recovery',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(recoveredResponse.statusCode, 200);
  assert.equal(recoveredResponse.body.summary.totalRecoveredAmount, '1200.00');
  assert.equal(outstandingResponse.statusCode, 200);
  assert.equal(outstandingResponse.body.summary.totalOutstandingAmount, '500.00');
  assert.equal(recoveryResponse.statusCode, 200);
  assert.equal(recoveryResponse.body.summary.totalLoans, 2);
  assert.deepEqual(calls, [
    ['getRecoveredLoans', 'admin'],
    ['getOutstandingLoans', 'admin'],
    ['getRecoveryReport', 'admin'],
  ]);
});

test('createReportsRouter requires admin access', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() {
        throw new Error('getRecoveredLoans should not be called');
      },
      async getOutstandingLoans() {
        throw new Error('getOutstandingLoans should not be called');
      },
      async getRecoveryReport() {
        throw new Error('getRecoveryReport should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/recovered',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'agent' },
  });

  assert.equal(response.statusCode, 403);
});
