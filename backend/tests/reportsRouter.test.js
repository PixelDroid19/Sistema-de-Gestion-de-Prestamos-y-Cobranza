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
        calls.push(['getRecoveredLoans', input.actor.role, input.pagination]);
        return {
          success: true,
          count: 1,
          summary: { totalRecoveredAmount: '1200.00' },
          data: {
            loans: [{ id: 4 }],
            pagination: { page: input.pagination.page, pageSize: input.pagination.pageSize, totalItems: 1, totalPages: 1 },
          },
        };
      },
      async getOutstandingLoans(input) {
        calls.push(['getOutstandingLoans', input.actor.role, input.pagination]);
        return {
          success: true,
          count: 1,
          summary: { totalOutstandingAmount: '500.00' },
          data: {
            loans: [{ id: 5 }],
            pagination: { page: input.pagination.page, pageSize: input.pagination.pageSize, totalItems: 1, totalPages: 1 },
          },
        };
      },
      async getRecoveryReport(input) {
        calls.push(['getRecoveryReport', input.actor.role, input.pagination]);
        return {
          success: true,
          summary: { totalLoans: 2 },
          data: {
            recoveredLoans: [{ id: 4 }],
            outstandingLoans: [{ id: 5 }],
          },
        };
      },
      async getDashboardSummary(input) {
        calls.push(['getDashboardSummary', input.actor.role]);
        return { success: true, data: { summary: { totalLoans: 2 } } };
      },
      async getCustomerHistory(input) {
        calls.push(['getCustomerHistory', input.customerId]);
        return { success: true, data: { customer: { id: Number(input.customerId) }, timeline: [] } };
      },
      async getCustomerCreditProfile(input) {
        calls.push(['getCustomerCreditProfile', input.customerId]);
        return { success: true, data: { customer: { id: Number(input.customerId) }, profile: { completeness: { isComplete: true } } } };
      },
      async getCustomerProfitabilityReport(input) {
        calls.push(['getCustomerProfitabilityReport', input.pagination]);
        return {
          success: true,
          summary: { totalProfit: '10.00' },
          data: {
            customers: [{ customerId: 7 }],
            pagination: { page: input.pagination.page, pageSize: input.pagination.pageSize, totalItems: 1, totalPages: 1 },
          },
        };
      },
      async getLoanProfitabilityReport(input) {
        calls.push(['getLoanProfitabilityReport', input.pagination]);
        return {
          success: true,
          summary: { totalProfit: '10.00' },
          data: {
            loans: [{ loanId: 4 }],
            pagination: { page: input.pagination.page, pageSize: input.pagination.pageSize, totalItems: 1, totalPages: 1 },
          },
        };
      },
      async exportRecoveryReport() {
        return {
          fileName: 'recovery-report.csv',
          contentType: 'text/csv; charset=utf-8',
          buffer: Buffer.from('header\nvalue', 'utf8'),
        };
      },
      async getCustomerCreditHistory() {
        return { loan: { id: 4, status: 'closed' }, snapshot: { totalPaid: 100 }, payments: [], payoffHistory: [{ id: 9, payoff: { asOfDate: '2026-03-15' } }], closure: { closureReason: 'payoff' } };
      },
      async getAssociateProfitabilityReport() {
        return { associate: { id: 7, participationPercentage: '25.0000' }, summary: { totalContributed: '1000.00', participationPercentage: '25.0000' }, data: { contributions: [], distributions: [{ id: 4, distributionType: 'proportional', declaredProportionalTotal: '600.00', allocatedAmount: '150.00' }] } };
      },
      async exportAssociateProfitabilityReport() {
        return {
          fileName: 'associate-7-profitability.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('PKtest', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const recoveredResponse = await requestJson(activeServer, {
    path: '/recovered?page=2&pageSize=5',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const outstandingResponse = await requestJson(activeServer, {
    path: '/outstanding?page=3&pageSize=4',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const recoveryResponse = await requestJson(activeServer, {
    path: '/recovery',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const dashboardResponse = await requestJson(activeServer, {
    path: '/dashboard',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const customerHistoryResponse = await requestJson(activeServer, {
    path: '/customer-history/7',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const customerProfileResponse = await requestJson(activeServer, {
    path: '/customer-credit-profile/7',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const customerProfitabilityResponse = await requestJson(activeServer, {
    path: '/profitability/customers?page=4&pageSize=3',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const loanProfitabilityResponse = await requestJson(activeServer, {
    path: '/profitability/loans?page=5&pageSize=2',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(recoveredResponse.statusCode, 200);
  assert.equal(recoveredResponse.body.summary.totalRecoveredAmount, '1200.00');
  assert.deepEqual(recoveredResponse.body.data.pagination, { page: 2, pageSize: 5, totalItems: 1, totalPages: 1 });
  assert.equal(outstandingResponse.statusCode, 200);
  assert.equal(outstandingResponse.body.summary.totalOutstandingAmount, '500.00');
  assert.deepEqual(outstandingResponse.body.data.pagination, { page: 3, pageSize: 4, totalItems: 1, totalPages: 1 });
  assert.equal(recoveryResponse.statusCode, 200);
  assert.equal(recoveryResponse.body.summary.totalLoans, 2);
  assert.equal(recoveryResponse.body.data.pagination, undefined);
  assert.equal(dashboardResponse.statusCode, 200);
  assert.equal(dashboardResponse.body.data.summary.totalLoans, 2);
  assert.equal(customerHistoryResponse.statusCode, 200);
  assert.equal(customerHistoryResponse.body.data.customer.id, 7);
  assert.equal(customerProfileResponse.statusCode, 200);
  assert.equal(customerProfileResponse.body.data.profile.completeness.isComplete, true);
  assert.equal(customerProfitabilityResponse.statusCode, 200);
  assert.equal(customerProfitabilityResponse.body.data.customers[0].customerId, 7);
  assert.deepEqual(customerProfitabilityResponse.body.data.pagination, { page: 4, pageSize: 3, totalItems: 1, totalPages: 1 });
  assert.equal(loanProfitabilityResponse.statusCode, 200);
  assert.equal(loanProfitabilityResponse.body.data.loans[0].loanId, 4);
  assert.deepEqual(loanProfitabilityResponse.body.data.pagination, { page: 5, pageSize: 2, totalItems: 1, totalPages: 1 });
  assert.deepEqual(calls, [
    ['getRecoveredLoans', 'admin', { page: 2, pageSize: 5, limit: 5, offset: 5 }],
    ['getOutstandingLoans', 'admin', { page: 3, pageSize: 4, limit: 4, offset: 8 }],
    ['getRecoveryReport', 'admin', undefined],
    ['getDashboardSummary', 'admin'],
    ['getCustomerHistory', '7'],
    ['getCustomerCreditProfile', '7'],
    ['getCustomerProfitabilityReport', { page: 4, pageSize: 3, limit: 3, offset: 9 }],
    ['getLoanProfitabilityReport', { page: 5, pageSize: 2, limit: 2, offset: 8 }],
  ]);
});

test('createReportsRouter rejects invalid pagination parameters', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() {
        throw new Error('getRecoveredLoans should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message,
        errors: error.errors || [],
      },
    });
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/recovered?page=0&pageSize=500',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.deepEqual(response.body.error.errors, [
    { field: 'page', message: 'page must be a positive integer' },
    { field: 'pageSize', message: 'pageSize must be less than or equal to 100' },
  ]);
});

test('createReportsRouter serves export and credit-history contracts', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async getCustomerHistory() { return { success: true, data: { customer: { id: 7 }, timeline: [] } }; },
      async exportRecoveryReport() {
        return {
          fileName: 'recovery-report.csv',
          contentType: 'text/csv; charset=utf-8',
          buffer: Buffer.from('header\nvalue', 'utf8'),
        };
      },
      async getCustomerCreditHistory() {
        return { loan: { id: 12 }, snapshot: { totalPaid: 300 }, payments: [], payoffHistory: [{ id: 8 }], closure: { closureReason: 'payoff' } };
      },
      async getAssociateProfitabilityReport() {
        return { associate: { id: 7, participationPercentage: '25.0000' }, summary: { totalContributed: '1000.00', participationPercentage: '25.0000' }, data: { contributions: [], distributions: [{ id: 4, distributionType: 'proportional', declaredProportionalTotal: '600.00', allocatedAmount: '150.00' }] } };
      },
      async exportAssociateProfitabilityReport() {
        return {
          fileName: 'associate-7-profitability.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('PKtest', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const exportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/recovery/export?format=csv`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const historyResponse = await requestJson(activeServer, {
    path: '/credit-history/loan/12',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });
  const associateExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/7/export?format=xlsx`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(exportResponse.status, 200);
  assert.match(await exportResponse.text(), /header/);
  assert.equal(historyResponse.statusCode, 200);
  assert.equal(historyResponse.body.data.history.loan.id, 12);
  assert.equal(historyResponse.body.data.history.closure.closureReason, 'payoff');
  assert.equal(associateExportResponse.status, 200);
  assert.equal((await associateExportResponse.arrayBuffer()).byteLength > 0, true);
});

test('createReportsRouter returns success when customer history has empty segments', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async getCustomerHistory() {
        return {
          success: true,
          data: {
            customer: { id: 7, name: 'Ana Customer' },
            timeline: [{ id: 'loan-11', entityType: 'loan' }],
            segments: {
              loans: [{ id: 11, status: 'approved' }],
              payments: [],
              documents: [],
              alerts: [],
              promises: [{ id: 15, status: 'pending' }],
              notifications: [],
            },
          },
        };
      },
      async exportRecoveryReport() {
        return {
          fileName: 'recovery-report.csv',
          contentType: 'text/csv; charset=utf-8',
          buffer: Buffer.from('header\nvalue', 'utf8'),
        };
      },
      async getCustomerCreditHistory() {
        return { loan: { id: 12 }, snapshot: { totalPaid: 300 }, payments: [], payoffHistory: [], closure: { closureReason: null } };
      },
      async getAssociateProfitabilityReport() {
        return { associate: { id: 7, participationPercentage: '25.0000' }, summary: { totalContributed: '1000.00', participationPercentage: '25.0000' }, data: { contributions: [], distributions: [] } };
      },
      async exportAssociateProfitabilityReport() {
        return {
          fileName: 'associate-7-profitability.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('PKtest', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/customer-history/7',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.customer.id, 7);
  assert.equal(response.body.data.segments.loans.length, 1);
  assert.deepEqual(response.body.data.segments.payments, []);
  assert.deepEqual(response.body.data.segments.documents, []);
  assert.deepEqual(response.body.data.segments.notifications, []);
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
      async getDashboardSummary() {
        throw new Error('getDashboardSummary should not be called');
      },
      async getCustomerHistory() {
        throw new Error('getCustomerHistory should not be called');
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

test('createReportsRouter limits associate export routes to admin and socio roles', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociateProfitabilityReport() {
        throw new Error('exportAssociateProfitabilityReport should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/7/export?format=xlsx`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'agent' },
  });

  assert.equal(response.status, 403);
});
