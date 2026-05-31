const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const roleAwareAuth = (options = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  const allowedRoles = Array.isArray(options)
    ? options
    : (options?.permissions ? ['admin', 'employee'] : []);
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    res.status(403).json({ success: false, error: { message: 'No tienes acceso a esta acción.', statusCode: 403 } });
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
      async exportCustomerHistory() {
        return {
          fileName: 'customer-7-history.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
      },
      async exportCustomerCreditProfile() {
        return {
          fileName: 'customer-7-credit-profile.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
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
      async exportCustomerProfitabilityReport(input) {
        calls.push(['exportCustomerProfitabilityReport', input.actor.role, input.filters]);
        return {
          fileName: 'rentabilidad-clientes.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('PKtest', 'utf8'),
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
      async exportCustomerCreditHistory() {
        return {
          fileName: 'loan-4-credit-history.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
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
  const customerProfitabilityExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/profitability/customers/export?fromDate=2026-05-01&toDate=2026-05-20`, {
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
  assert.equal(customerProfitabilityExportResponse.status, 200);
  assert.equal((await customerProfitabilityExportResponse.arrayBuffer()).byteLength > 0, true);
  assert.equal(loanProfitabilityResponse.statusCode, 200);
  assert.equal(loanProfitabilityResponse.body.data.loans[0].loanId, 4);
  assert.deepEqual(loanProfitabilityResponse.body.data.pagination, { page: 5, pageSize: 2, totalItems: 1, totalPages: 1 });
  assert.deepEqual(calls, [
    ['getRecoveredLoans', 'admin', { page: 2, pageSize: 5, limit: 5, offset: 5 }],
    ['getOutstandingLoans', 'admin', { page: 3, pageSize: 4, limit: 4, offset: 8 }],
    ['getRecoveryReport', 'admin', undefined],
    ['getDashboardSummary', 'admin'],
    ['getCustomerHistory', 7],
    ['getCustomerCreditProfile', 7],
    ['getCustomerProfitabilityReport', { page: 4, pageSize: 3, limit: 3, offset: 9 }],
    ['exportCustomerProfitabilityReport', 'admin', { fromDate: '2026-05-01', toDate: '2026-05-20' }],
    ['getLoanProfitabilityReport', { page: 5, pageSize: 2, limit: 2, offset: 8 }],
  ]);
});

test('createReportsRouter rejects malformed payment schedule loan identifiers', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getPaymentSchedule(input) {
        calls.push(input);
        return { success: true, data: { schedule: [] } };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/payment-schedule/1e2',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /número del crédito/i);
  assert.equal(calls.length, 0);
});

test('createReportsRouter rejects malformed customer report identifiers before executing reports', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getCustomerHistory(input) {
        calls.push(['getCustomerHistory', input.customerId]);
        return { success: true, data: { customer: { id: Number(input.customerId) }, timeline: [] } };
      },
      async getCustomerCreditProfile(input) {
        calls.push(['getCustomerCreditProfile', input.customerId]);
        return { success: true, data: { customer: { id: Number(input.customerId) }, profile: {} } };
      },
      async exportCustomerHistory(input) {
        calls.push(['exportCustomerHistory', input.customerId]);
        return { fileName: 'customer-history.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') };
      },
      async exportCustomerCreditProfile(input) {
        calls.push(['exportCustomerCreditProfile', input.customerId]);
        return { fileName: 'customer-credit-profile.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });

  activeServer = await listen(app);

  const responses = await Promise.all([
    requestJson(activeServer, {
      path: '/customer-history/7abc',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/customer-credit-profile/1e2',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/customer-history/1.5/export',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/customer-credit-profile/foo/export?format=pdf',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
  ]);

  for (const response of responses) {
    assert.equal(response.statusCode, 400);
    assert.match(response.body.error.message, /número del cliente/i);
  }
  assert.deepEqual(calls, []);
});

test('createReportsRouter rejects malformed credit and associate report identifiers before executing reports', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getCustomerCreditHistory(input) {
        calls.push(['getCustomerCreditHistory', input.loanId]);
        return { loan: { id: Number(input.loanId) }, snapshot: {}, payments: [] };
      },
      async exportCustomerCreditHistory(input) {
        calls.push(['exportCustomerCreditHistory', input.loanId]);
        return { fileName: 'credit-history.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') };
      },
      async getAssociateProfitabilityReport(input) {
        calls.push(['getAssociateProfitabilityReport', input.associateId]);
        return { associate: { id: Number(input.associateId) }, summary: {} };
      },
      async exportAssociateProfitabilityReport(input) {
        calls.push(['exportAssociateProfitabilityReport', input.associateId]);
        return {
          fileName: 'associate-profitability.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('PKtest'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });

  activeServer = await listen(app);

  const responses = await Promise.all([
    requestJson(activeServer, {
      path: '/credit-history/loan/10abc',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/credit-history/loan/1e2/export',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/associates/profitability/7.5',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/associates/abc/export',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      path: '/partner-report/1e2',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
  ]);

  assert.equal(responses[0].statusCode, 400);
  assert.match(responses[0].body.error.message, /número del crédito/i);
  assert.equal(responses[1].statusCode, 400);
  assert.match(responses[1].body.error.message, /número del crédito/i);
  assert.equal(responses[2].statusCode, 400);
  assert.match(responses[2].body.error.message, /número del socio/i);
  assert.equal(responses[3].statusCode, 400);
  assert.match(responses[3].body.error.message, /número del socio/i);
  assert.equal(responses[4].statusCode, 400);
  assert.match(responses[4].body.error.message, /número del socio/i);
  assert.deepEqual(calls, []);
});

test('createReportsRouter protects credit payment schedules with credit view permission', async () => {
  const authOptions = [];
  const router = createReportsRouter({
    authMiddleware: (options) => (req, _res, next) => {
      authOptions.push(options);
      req.user = { id: 7, role: 'employee' };
      next();
    },
    useCases: {
      async getPaymentSchedule(input) {
        return { success: true, data: { loanId: input.loanId, schedule: [] } };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/payment-schedule/42',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'employee' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(authOptions, [{ permissions: ['CREDITS_VIEW_ALL'] }]);
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
    { field: 'page', message: 'La página debe ser un entero positivo' },
    { field: 'pageSize', message: 'El tamaño de página debe ser menor o igual a 100' },
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
      async exportCustomerHistory() {
        return {
          fileName: 'customer-7-history.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
      },
      async exportCustomerCreditProfile() {
        return {
          fileName: 'customer-7-credit-profile.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
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
        return { loan: { id: 12 }, snapshot: { totalPaid: 300 }, payments: [], payoffHistory: [{ id: 8 }], closure: { closureReason: 'payoff' } };
      },
      async exportCustomerCreditHistory() {
        return {
          fileName: 'loan-12-credit-history.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
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
  const customerHistoryExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/customer-history/7/export?format=pdf`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const customerProfileExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/customer-credit-profile/7/export?format=pdf`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const historyResponse = await requestJson(activeServer, {
    path: '/credit-history/loan/12',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const loanHistoryExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/credit-history/loan/12/export?format=pdf`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const associateExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/7/export?format=xlsx`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(exportResponse.status, 200);
  assert.match(await exportResponse.text(), /header/);
  assert.equal(customerHistoryExportResponse.status, 200);
  assert.match(await customerHistoryExportResponse.text(), /%PDF-1.4/);
  assert.equal(customerProfileExportResponse.status, 200);
  assert.match(await customerProfileExportResponse.text(), /%PDF-1.4/);
  assert.equal(historyResponse.statusCode, 200);
  assert.equal(historyResponse.body.data.history.loan.id, 12);
  assert.equal(historyResponse.body.data.history.closure.closureReason, 'payoff');
  assert.equal(loanHistoryExportResponse.status, 200);
  assert.match(await loanHistoryExportResponse.text(), /%PDF-1.4/);
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
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(response.statusCode, 403);
});

test('createReportsRouter rejects customer records from administrative credit history report routes', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getCustomerCreditHistory() {
        throw new Error('getCustomerCreditHistory should not be called');
      },
      async exportCustomerCreditHistory() {
        throw new Error('exportCustomerCreditHistory should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const historyResponse = await requestJson(activeServer, {
    path: '/credit-history/loan/12',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });
  const exportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/credit-history/loan/12/export?format=pdf`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(historyResponse.statusCode, 403);
  assert.equal(exportResponse.status, 403);
});

test('createReportsRouter rejects socio records from administrative associate export routes', async () => {
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
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'socio' },
  });

  assert.equal(response.status, 403);
});

test('createReportsRouter exposes comparative/earnings routes and removes legacy file export aliases', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getComparativeAnalysis(input) {
        calls.push(['getComparativeAnalysis', input.year]);
        return { success: true, data: { year: input.year || 2026, comparison: [] } };
      },
      async getMonthlyEarnings(input) {
        calls.push(['getMonthlyEarnings', input.year]);
        return { success: true, data: { year: input.year || 2026, months: [{ month: 1, net: '100.00' }] } };
      },
      async getInterestEarnings(input) {
        calls.push(['getInterestEarnings', input.year]);
        return { success: true, data: { byMonth: [{ month: 1, interest: '20.00' }], totalInterest: '20.00' } };
      },
      async exportAssociateProfitabilityReport() {
        calls.push(['exportAssociateProfitabilityReport']);
        return {
          fileName: 'associate-7-profitability.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('PKtest', 'utf8'),
        };
      },
      async exportRecoveryReport() {
        calls.push(['exportRecoveryReport']);
        return {
          fileName: 'recovery-report.csv',
          contentType: 'text/csv; charset=utf-8',
          buffer: Buffer.from('header\nvalue', 'utf8'),
        };
      },
      async exportCreditsExcel() {
        calls.push(['exportCreditsExcel']);
        return {
          success: true,
          data: {
            sheets: [{
              name: 'Detalle de Créditos',
              columns: [{ header: 'Crédito', key: 'creditId' }],
              rows: [{ creditId: 44 }],
            }],
          },
        };
      },
      async exportPayoutsExcel(input) {
        calls.push(['exportPayoutsExcel', input.filters]);
        return {
          success: true,
          data: {
            sheets: [{
              name: 'Pagos',
              columns: [{ header: 'Pago', key: 'paymentId' }],
              rows: [{ paymentId: 9 }],
            }],
          },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const comparativeResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/comparative-analysis',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { year: '2025' },
  });
  const earningsResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/earnings-report',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { year: '2024' },
  });
  const partnerReportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/partner-report/7?format=xlsx`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const canonicalPayoutExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/payouts/excel?startDate=2026-01-01&endDate=2026-01-31`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const legacyCreditsExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/file/reports/credits/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const legacyRecoveryExportResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/file/reports/recovery/export?format=csv`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(comparativeResponse.statusCode, 200);
  assert.equal(comparativeResponse.body.success, true);
  assert.equal(comparativeResponse.body.data.year, 2025);

  assert.equal(earningsResponse.statusCode, 200);
  assert.deepEqual(earningsResponse.body, {
    success: true,
    data: {
      year: 2024,
      monthlyEarnings: [{ month: 1, net: '100.00' }],
      interestEarnings: [{ month: 1, interest: '20.00' }],
      totalInterest: '20.00',
    },
  });

  assert.equal(partnerReportResponse.status, 200);
  assert.equal((await partnerReportResponse.arrayBuffer()).byteLength > 0, true);

  assert.equal(canonicalPayoutExportResponse.status, 200);
  assert.equal((await canonicalPayoutExportResponse.arrayBuffer()).byteLength > 0, true);

  assert.equal(legacyCreditsExportResponse.status, 404);
  assert.equal(legacyRecoveryExportResponse.status, 404);

  assert.deepEqual(calls, [
    ['getComparativeAnalysis', 2025],
    ['getMonthlyEarnings', 2024],
    ['getInterestEarnings', 2024],
    ['exportAssociateProfitabilityReport'],
    ['exportPayoutsExcel', {
      customerId: undefined,
      loanId: undefined,
      creditId: undefined,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      status: undefined,
      paymentType: undefined,
    }],
  ]);
});
