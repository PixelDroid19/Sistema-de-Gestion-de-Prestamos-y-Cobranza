const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createReportsRouter } = require('../src/modules/reports/presentation/router');
const { closeServer, listen } = require('./helpers/http');

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

test('GET /reports/credits/excel returns xlsx file for admin', async () => {
  const mockLoans = [
    { id: 1, customerId: 10, amount: 50000, status: 'active', recoveryStatus: 'pending', Customer: { name: 'Juan', email: 'juan@test.com', phone: '123' }, Associate: { name: 'Assoc1' }, toJSON: function() { return this; } },
    { id: 2, customerId: 11, amount: 75000, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Maria', email: 'maria@test.com', phone: '456' }, Associate: { name: 'Assoc2' }, toJSON: function() { return this; } },
  ];

  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async exportCreditsExcel(input) {
        assert.equal(input.actor.role, 'admin');
        return {
          success: true,
          data: {
            rows: mockLoans.map(l => ({
              loanId: l.id,
              customerName: l.Customer.name,
              amount: l.amount,
              status: l.status,
            })),
          },
        };
      },
      async exportRecoveryReport() {
        return { fileName: 'recovery-report.csv', contentType: 'text/csv', buffer: Buffer.from('test') };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/credits/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="credits-export.xlsx"');

  const arrayBuffer = await response.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 0, 'Should return non-empty buffer');
});

test('GET /reports/credits/excel rejects non-admin users', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportCreditsExcel() {
        throw new Error('Should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/credits/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(response.status, 403);
});

test('GET /reports/credits/summary returns summary data for admin', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getCreditsSummary(input) {
        assert.equal(input.actor.role, 'admin');
        return {
          success: true,
          data: {
            summary: {
              totalLoans: 10,
              totalAmount: '500000.00',
              totalPaid: '200000.00',
              totalOutstanding: '300000.00',
              activeCount: 5,
              defaultedCount: 2,
              closedCount: 3,
            },
            byStatus: { active: 5, defaulted: 2, closed: 3 },
            byRecoveryStatus: { recovered: 3, pending: 4, inProgress: 2, overdue: 1 },
          },
        };
      },
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async exportRecoveryReport() {
        return { fileName: 'recovery-report.csv', contentType: 'text/csv', buffer: Buffer.from('test') };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/credits/summary`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.summary.totalLoans, 10);
  assert.equal(body.data.summary.totalAmount, '500000.00');
  assert.equal(body.data.byStatus.active, 5);
});

test('GET /reports/credits/summary rejects non-admin users', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getCreditsSummary() {
        throw new Error('Should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/credits/summary`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(response.status, 403);
});

test('GET /reports/associates/excel returns xlsx file for admin', async () => {
  const mockRows = [
    { associateId: 1, associateName: 'Socio 1', section: 'summary', amount: '10000', date: 'Distributed: 500', status: 'active', participationPercentage: '25.0000' },
    { associateId: 1, associateName: 'Socio 1', section: 'contribution', entryId: 1, amount: '5000', date: '2024-01-15', status: 'completed', participationPercentage: '25.0000' },
  ];

  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async exportAssociatesExcel(input) {
        assert.equal(input.actor.role, 'admin');
        return {
          success: true,
          data: { rows: mockRows },
        };
      },
      async exportRecoveryReport() {
        return { fileName: 'recovery-report.csv', contentType: 'text/csv', buffer: Buffer.from('test') };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="associates-export.xlsx"');

  const arrayBuffer = await response.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 0, 'Should return non-empty buffer');
});

test('GET /reports/associates/excel allows socio role', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async exportAssociatesExcel(input) {
        assert.equal(input.actor.role, 'socio');
        return { success: true, data: { rows: [] } };
      },
      async exportRecoveryReport() {
        return { fileName: 'recovery-report.csv', contentType: 'text/csv', buffer: Buffer.from('test') };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'socio' },
  });

  assert.equal(response.status, 200);
});

test('GET /reports/associates/excel rejects customer role', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesExcel() {
        throw new Error('Should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(response.status, 403);
});
