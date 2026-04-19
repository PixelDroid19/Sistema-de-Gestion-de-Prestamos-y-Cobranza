const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { closeServer, listen, requestJson } = require('../helpers/http');

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

const buildMockUseCases = (calls = []) => ({
  async getCreditEarnings(input) {
    calls.push(['getCreditEarnings', input.actor.role]);
    return { success: true, data: { totalCredits: 10, totalLoanAmount: '100000.00', totalInterestEarnings: '15000.00', profitMargin: '15.00' } };
  },
  async getInterestEarnings(input) {
    calls.push(['getInterestEarnings', input.actor.role, input.year]);
    return { success: true, data: { totalInterest: '12000.00', byMonth: [{ month: '2026-01', interest: '1000.00' }] } };
  },
  async getMonthlyEarnings(input) {
    calls.push(['getMonthlyEarnings', input.actor.role, input.year]);
    return { success: true, data: { year: 2026, months: [{ month: '2026-01', totalEarnings: '5000.00', trend: 'up', changePercent: 10, movingAverage: '4800.00' }] } };
  },
  async getMonthlyInterest(input) {
    calls.push(['getMonthlyInterest', input.actor.role, input.year]);
    return { success: true, data: { year: 2026, totalInterest: '12000.00', months: [{ month: '2026-01', interest: '1000.00' }] } };
  },
  async getPerformanceAnalysis(input) {
    calls.push(['getPerformanceAnalysis', input.actor.role, input.year]);
    return { success: true, data: { year: 2026, summary: { totalEarnings: '60000.00', totalInterest: '12000.00', paymentCount: 150 }, monthlyPerformance: [] } };
  },
  async getExecutiveDashboard(input) {
    calls.push(['getExecutiveDashboard', input.actor.role]);
    return { success: true, data: { period: 2026, summary: { totalEarnings: '60000.00' }, trends: { earningsTrend: 'up' }, monthlyEarnings: [] } };
  },
  async getComprehensiveAnalytics(input) {
    calls.push(['getComprehensiveAnalytics', input.actor.role, input.year]);
    return { success: true, data: { year: 2026, summary: { totalEarnings: '60000.00' }, yearOverYear: {}, monthlyDetails: [] } };
  },
  async getComparativeAnalysis(input) {
    calls.push(['getComparativeAnalysis', input.actor.role, input.year]);
    return { success: true, data: { currentYear: 2026, previousYear: 2025, comparison: { earnings: { current: '60000.00', previous: '50000.00', changePercent: 20 } } } };
  },
  async getForecastAnalysis(input) {
    calls.push(['getForecastAnalysis', input.actor.role, input.year]);
    return { success: true, data: { year: 2026, historicalData: [], forecast: { nextMonthEarnings: '5500.00', slope: 100, intercept: 4000 }, analysis: { trend: 'up' } } };
  },
  async getNextMonthProjection(input) {
    calls.push(['getNextMonthProjection', input.actor.role]);
    return { success: true, data: { projection: { month: '2026-04', projectedEarnings: '5500.00', confidenceLevel: 'medium' }, model: { slope: 100, intercept: 4000 }, historicalSummary: {} } };
  },
  // Required existing use cases for router
  async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
  async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
  async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
  async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
  async getCustomerHistory() { return { success: true, data: { customer: { id: 1 }, timeline: [] } }; },
  async getCustomerCreditProfile() { return { success: true, data: { customer: { id: 1 }, profile: {} } }; },
  async exportCustomerHistory() { return { fileName: 'test.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4', 'utf8') }; },
  async exportCustomerCreditProfile() { return { fileName: 'test.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4', 'utf8') }; },
  async exportCustomerCreditHistory() { return { fileName: 'test.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4', 'utf8') }; },
  async exportRecoveryReport() { return { fileName: 'test.csv', contentType: 'text/csv', buffer: Buffer.from('header\n', 'utf8') }; },
  async getAssociateProfitabilityReport() { return { associate: { id: 1 }, summary: {}, data: {} }; },
  async exportAssociateProfitabilityReport() { return { fileName: 'test.xlsx', contentType: 'application/xlsx', buffer: Buffer.from('PK', 'utf8') }; },
  async getCustomerProfitabilityReport() { return { success: true, data: { customers: [] }, summary: {} }; },
  async getLoanProfitabilityReport() { return { success: true, data: { loans: [] }, summary: {} }; },
  async getCustomerCreditHistory() { return { loan: {}, snapshot: {}, payments: [], payoffHistory: [], closure: {} }; },
});

test('Financial analytics routes require admin access', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const routes = [
    '/credit-earnings',
    '/interest-earnings',
    '/monthly-earnings',
    '/monthly-interest',
    '/performance-analysis',
    '/executive-dashboard',
    '/comprehensive-analytics',
    '/comparative-analysis',
    '/forecast-analysis',
    '/next-month-projection',
  ];

  for (const path of routes) {
    const response = await requestJson(activeServer, {
      path,
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
    });
    assert.equal(response.statusCode, 403, `Route ${path} should require admin access`);
  }
});

test('GET /credit-earnings returns credit earnings data', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/credit-earnings',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.totalCredits, 10);
  assert.equal(response.body.data.totalLoanAmount, '100000.00');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'getCreditEarnings');
});

test('GET /interest-earnings accepts year parameter', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/interest-earnings?year=2025',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0][2], 2025);
});

test('GET /monthly-earnings returns monthly earnings with trend analysis', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/monthly-earnings?year=2026',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.year, 2026);
  assert.ok(Array.isArray(response.body.data.months));
  assert.equal(calls[0][0], 'getMonthlyEarnings');
});

test('GET /monthly-interest returns monthly interest breakdown', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/monthly-interest',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.totalInterest, '12000.00');
});

test('GET /performance-analysis returns comprehensive KPIs', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/performance-analysis?year=2026',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.year, 2026);
  assert.ok(response.body.data.summary);
  assert.ok('totalEarnings' in response.body.data.summary);
});

test('GET /executive-dashboard returns executive KPIs', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/executive-dashboard',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.data.period);
  assert.ok(response.body.data.summary);
  assert.ok(response.body.data.trends);
});

test('GET /comprehensive-analytics returns full analytics', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/comprehensive-analytics?year=2026',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.data.yearOverYear);
  assert.ok(response.body.data.monthlyDetails);
});

test('GET /comparative-analysis returns period comparison', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/comparative-analysis?year=2026',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.currentYear, 2026);
  assert.equal(response.body.data.previousYear, 2025);
  assert.ok(response.body.data.comparison);
});

test('GET /forecast-analysis returns forecast using linear regression', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/forecast-analysis?year=2026',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.data.forecast);
  assert.ok('nextMonthEarnings' in response.body.data.forecast);
  assert.ok('slope' in response.body.data.forecast);
  assert.ok('intercept' in response.body.data.forecast);
});

test('GET /next-month-projection returns next month projection', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/next-month-projection',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.data.projection);
  assert.ok('projectedEarnings' in response.body.data.projection);
  assert.ok('confidenceLevel' in response.body.data.projection);
  assert.ok(response.body.data.model);
});

test('All 10 financial analytics routes are accessible', async () => {
  const calls = [];
  const useCases = buildMockUseCases(calls);
  const router = createReportsRouter({ authMiddleware: roleAwareAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const routes = [
    { path: '/credit-earnings', method: 'GET' },
    { path: '/interest-earnings', method: 'GET' },
    { path: '/monthly-earnings', method: 'GET' },
    { path: '/monthly-interest', method: 'GET' },
    { path: '/performance-analysis', method: 'GET' },
    { path: '/executive-dashboard', method: 'GET' },
    { path: '/comprehensive-analytics', method: 'GET' },
    { path: '/comparative-analysis', method: 'GET' },
    { path: '/forecast-analysis', method: 'GET' },
    { path: '/next-month-projection', method: 'GET' },
  ];

  for (const route of routes) {
    const response = await requestJson(activeServer, {
      path: route.path,
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    });
    assert.equal(response.statusCode, 200, `Route ${route.path} should return 200`);
  }

  assert.equal(calls.length, 10);
});
