const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const ExcelJS = require('exceljs');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');
const {
  buildMonthlyCashFlowReport,
  buildDailyCashFlowReport,
  buildAnnualCashFlowReport,
  createGetMonthlyCashFlow,
  createGetDailyCashFlow,
  createGetAnnualCashFlow,
  createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf,
} = require('@/modules/reports/application/useCases/createMonthlyCashFlowReport');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const makeLoan = (overrides = {}) => ({
  id: overrides.id || 1,
  amount: overrides.amount ?? 0,
  status: overrides.status || 'active',
  startDate: overrides.startDate || overrides.createdAt || '2026-01-05T00:00:00.000Z',
  createdAt: overrides.createdAt || overrides.startDate || '2026-01-05T00:00:00.000Z',
  principalOutstanding: overrides.principalOutstanding ?? 0,
  financialSnapshot: overrides.financialSnapshot || {},
  ...overrides,
});

const makePayment = (overrides = {}) => ({
  id: overrides.id || 1,
  amount: overrides.amount ?? 0,
  principalApplied: overrides.principalApplied ?? 0,
  interestApplied: overrides.interestApplied ?? 0,
  penaltyApplied: overrides.penaltyApplied ?? 0,
  status: overrides.status || 'completed',
  paymentDate: overrides.paymentDate || '2026-01-10T00:00:00.000Z',
  ...overrides,
});

const makeOperatingExpense = (overrides = {}) => ({
  id: overrides.id || 1,
  amount: overrides.amount ?? 0,
  status: overrides.status || 'completed',
  expenseDate: overrides.expenseDate || '2026-01-28T00:00:00.000Z',
  ...overrides,
});

const makeAssociatePayment = (overrides = {}) => ({
  id: overrides.id || 1,
  amount: overrides.amount ?? 0,
  status: overrides.status || 'paid',
  paidAt: overrides.paidAt || '2026-01-25T00:00:00.000Z',
  ...overrides,
});

const requestBuffer = (server, { path, headers = {} }) => new Promise((resolve, reject) => {
  const { port } = server.address();
  const request = http.request({
    hostname: '127.0.0.1',
    port,
    method: 'GET',
    path,
    headers,
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve({
      statusCode: response.statusCode,
      headers: response.headers,
      body: Buffer.concat(chunks),
    }));
  });
  request.on('error', reject);
  request.end();
});

test('buildMonthlyCashFlowReport reconciles monthly inflows, outflows, available cash, profit and losses', () => {
  const report = buildMonthlyCashFlowReport({
    year: 2026,
    loans: [
      makeLoan({ id: 1, amount: 40000000, status: 'active', startDate: '2026-01-02T00:00:00.000Z' }),
      makeLoan({ id: 2, amount: 5000000, status: 'rejected', startDate: '2026-01-08T00:00:00.000Z' }),
      makeLoan({
        id: 3,
        amount: 10000000,
        status: 'defaulted',
        startDate: '2026-02-03T00:00:00.000Z',
        principalOutstanding: 7000000,
      }),
    ],
    payments: [
      makePayment({ id: 10, amount: 50000000, principalApplied: 45000000, interestApplied: 4000000, penaltyApplied: 1000000, paymentDate: '2026-01-20T00:00:00.000Z' }),
      makePayment({ id: 11, amount: 1000000, principalApplied: 1000000, status: 'annulled', paymentDate: '2026-01-21T00:00:00.000Z' }),
      makePayment({ id: 12, amount: 8000000, principalApplied: 7000000, interestApplied: 1000000, paymentDate: '2026-02-20T00:00:00.000Z' }),
    ],
  });

  assert.equal(report.summary.totalInflows, '58000000.00');
  assert.equal(report.summary.totalOutflows, '50000000.00');
  assert.equal(report.summary.availableCash, '8000000.00');
  assert.equal(report.summary.totalCollectedProfit, '6000000.00');
  assert.equal(report.summary.lossesAtRisk, '7000000.00');
  assert.equal(report.summary.netProfitIndicator, '-1000000.00');

  assert.equal(report.months[0].month, '2026-01');
  assert.equal(report.months[0].inflows, '50000000.00');
  assert.equal(report.months[0].outflows, '40000000.00');
  assert.equal(report.months[0].availableCash, '10000000.00');
  assert.equal(report.months[0].collectedProfit, '5000000.00');

  assert.equal(report.months[1].month, '2026-02');
  assert.equal(report.months[1].inflows, '8000000.00');
  assert.equal(report.months[1].outflows, '10000000.00');
  assert.equal(report.months[1].availableCash, '8000000.00');
  assert.equal(report.months[1].lossesAtRisk, '7000000.00');
});

test('buildMonthlyCashFlowReport subtracts paid associate movements from available cash', () => {
  const report = buildMonthlyCashFlowReport({
    year: 2026,
    loans: [
      makeLoan({ id: 1, amount: 40000000, status: 'active', startDate: '2026-01-02T00:00:00.000Z' }),
    ],
    payments: [
      makePayment({ id: 10, amount: 50000000, principalApplied: 45000000, interestApplied: 5000000, paymentDate: '2026-01-20T00:00:00.000Z' }),
    ],
    associatePayments: [
      makeAssociatePayment({ id: 20, amount: 3000000, paidAt: '2026-01-25T00:00:00.000Z' }),
      makeAssociatePayment({ id: 21, amount: 1000000, distributionDate: '2026-02-01T00:00:00.000Z', paidAt: null }),
    ],
  });

  assert.equal(report.summary.totalInflows, '50000000.00');
  assert.equal(report.summary.totalOutflows, '40000000.00');
  assert.equal(report.summary.totalAssociatePayments, '4000000.00');
  assert.equal(report.summary.availableCash, '6000000.00');
  assert.equal(report.summary.netProfitIndicator, '1000000.00');
  assert.equal(report.months[0].associatePayments, '3000000.00');
  assert.equal(report.months[0].netCashFlow, '7000000.00');
  assert.equal(report.months[0].availableCash, '7000000.00');
  assert.equal(report.months[1].associatePayments, '1000000.00');
  assert.equal(report.months[1].availableCash, '6000000.00');
});

test('buildMonthlyCashFlowReport subtracts completed operating expenses from available cash', () => {
  const report = buildMonthlyCashFlowReport({
    year: 2026,
    loans: [
      makeLoan({ id: 1, amount: 40000000, status: 'active', startDate: '2026-01-02T00:00:00.000Z' }),
    ],
    payments: [
      makePayment({ id: 10, amount: 50000000, principalApplied: 45000000, interestApplied: 5000000, paymentDate: '2026-01-20T00:00:00.000Z' }),
    ],
    operatingExpenses: [
      makeOperatingExpense({ id: 40, amount: 2000000, expenseDate: '2026-01-28T00:00:00.000Z' }),
      makeOperatingExpense({ id: 41, amount: 1000000, status: 'annulled', expenseDate: '2026-01-29T00:00:00.000Z' }),
      makeOperatingExpense({ id: 42, amount: 500000, expenseDate: '2027-01-01T00:00:00.000Z' }),
    ],
  });

  assert.equal(report.summary.totalInflows, '50000000.00');
  assert.equal(report.summary.totalOutflows, '40000000.00');
  assert.equal(report.summary.totalOperatingExpenses, '2000000.00');
  assert.equal(report.summary.availableCash, '8000000.00');
  assert.equal(report.months[0].operatingExpenses, '2000000.00');
  assert.equal(report.months[0].netCashFlow, '8000000.00');
  assert.equal(report.months[0].availableCash, '8000000.00');
});

test('buildDailyCashFlowReport reconciles daily movements inside the selected range', () => {
  const report = buildDailyCashFlowReport({
    fromDate: new Date('2026-03-01T00:00:00.000Z'),
    toDate: new Date('2026-03-03T23:59:59.999Z'),
    loans: [
      makeLoan({ id: 1, amount: 40000000, status: 'active', startDate: '2026-03-01T14:00:00.000Z' }),
      makeLoan({ id: 2, amount: 10000000, status: 'defaulted', principalOutstanding: 8000000, startDate: '2026-03-03T14:00:00.000Z' }),
    ],
    payments: [
      makePayment({ id: 10, amount: 50000000, principalApplied: 45000000, interestApplied: 5000000, paymentDate: '2026-03-02T15:00:00.000Z' }),
      makePayment({ id: 11, amount: 1000000, status: 'annulled', paymentDate: '2026-03-02T16:00:00.000Z' }),
    ],
    associatePayments: [
      makeAssociatePayment({ id: 20, amount: 3000000, paidAt: '2026-03-02T18:00:00.000Z' }),
    ],
    operatingExpenses: [
      makeOperatingExpense({ id: 30, amount: 2000000, expenseDate: '2026-03-03T10:00:00.000Z' }),
      makeOperatingExpense({ id: 31, amount: 1000000, status: 'annulled', expenseDate: '2026-03-03T11:00:00.000Z' }),
    ],
  });

  assert.deepEqual(report.days.map((day) => day.date), ['2026-03-01', '2026-03-02', '2026-03-03']);
  assert.equal(report.summary.totalInflows, '50000000.00');
  assert.equal(report.summary.totalOutflows, '50000000.00');
  assert.equal(report.summary.totalAssociatePayments, '3000000.00');
  assert.equal(report.summary.totalOperatingExpenses, '2000000.00');
  assert.equal(report.summary.availableCash, '-5000000.00');
  assert.equal(report.summary.lossesAtRisk, '8000000.00');
  assert.equal(report.days[0].availableCash, '-40000000.00');
  assert.equal(report.days[1].associatePayments, '3000000.00');
  assert.equal(report.days[1].availableCash, '7000000.00');
  assert.equal(report.days[2].availableCash, '-5000000.00');
});

test('buildAnnualCashFlowReport compares annual cash flow with canonical movements', () => {
  const report = buildAnnualCashFlowReport({
    fromYear: 2025,
    toYear: 2026,
    loans: [
      makeLoan({ id: 1, amount: 20000000, status: 'active', startDate: '2025-03-01T00:00:00.000Z' }),
      makeLoan({ id: 2, amount: 10000000, status: 'defaulted', principalOutstanding: 6000000, startDate: '2026-04-01T00:00:00.000Z' }),
    ],
    payments: [
      makePayment({ id: 10, amount: 26000000, principalApplied: 24000000, interestApplied: 2000000, paymentDate: '2025-08-10T00:00:00.000Z' }),
      makePayment({ id: 11, amount: 8000000, principalApplied: 7000000, interestApplied: 1000000, paymentDate: '2026-08-10T00:00:00.000Z' }),
    ],
    associatePayments: [
      makeAssociatePayment({ id: 20, amount: 500000, paidAt: '2025-09-01T00:00:00.000Z' }),
      makeAssociatePayment({ id: 21, amount: 700000, paidAt: '2026-09-01T00:00:00.000Z' }),
    ],
    operatingExpenses: [
      makeOperatingExpense({ id: 30, amount: 300000, expenseDate: '2025-09-15T00:00:00.000Z' }),
      makeOperatingExpense({ id: 31, amount: 400000, expenseDate: '2026-09-15T00:00:00.000Z' }),
    ],
  });

  assert.equal(report.summary.totalInflows, '34000000.00');
  assert.equal(report.summary.totalOutflows, '30000000.00');
  assert.equal(report.summary.totalAssociatePayments, '1200000.00');
  assert.equal(report.summary.totalOperatingExpenses, '700000.00');
  assert.equal(report.summary.availableCash, '2100000.00');
  assert.equal(report.summary.lossesAtRisk, '6000000.00');
  assert.deepEqual(report.years.map((year) => year.year), ['2025', '2026']);
  assert.equal(report.years[0].netCashFlow, '5200000.00');
  assert.equal(report.years[1].netCashFlow, '-3100000.00');
});

test('createGetMonthlyCashFlow reads canonical dataset from repository', async () => {
  const useCase = createGetMonthlyCashFlow({
    reportRepository: {
      async listCashFlowDataset({ year }) {
        assert.equal(year, 2026);
        return {
          loans: [makeLoan({ amount: 40000000 })],
          payments: [makePayment({ amount: 50000000, principalApplied: 45000000, interestApplied: 5000000 })],
          associatePayments: [makeAssociatePayment({ amount: 3000000 })],
          operatingExpenses: [makeOperatingExpense({ amount: 2000000 })],
        };
      },
    },
  });

  const response = await useCase({ actor: { role: 'admin' }, year: 2026 });

  assert.equal(response.success, true);
  assert.equal(response.data.summary.totalAssociatePayments, '3000000.00');
  assert.equal(response.data.summary.totalOperatingExpenses, '2000000.00');
  assert.equal(response.data.summary.availableCash, '5000000.00');
  assert.equal(response.data.months.length, 12);
});

test('createGetMonthlyCashFlow forwards normalized date range filters to repository', async () => {
  const useCase = createGetMonthlyCashFlow({
    reportRepository: {
      async listCashFlowDataset({ year, fromDate, toDate }) {
        assert.equal(year, 2026);
        assert.equal(fromDate.toISOString(), '2026-03-01T00:00:00.000Z');
        assert.equal(toDate.toISOString(), '2026-03-31T23:59:59.999Z');
        return {
          loans: [makeLoan({ amount: 10000000, startDate: '2026-03-05T00:00:00.000Z' })],
          payments: [makePayment({ amount: 15000000, paymentDate: '2026-03-20T00:00:00.000Z' })],
          operatingExpenses: [makeOperatingExpense({ amount: 500000, expenseDate: '2026-03-26T00:00:00.000Z' })],
        };
      },
    },
  });

  const response = await useCase({
    actor: { role: 'admin' },
    year: 2026,
    filters: { fromDate: '2026-03-01', toDate: '2026-03-31' },
  });

  assert.equal(response.success, true);
  assert.equal(response.data.filters.fromDate, '2026-03-01');
  assert.equal(response.data.filters.toDate, '2026-03-31');
  assert.equal(response.data.months[2].availableCash, '4500000.00');
});

test('createGetDailyCashFlow reads canonical dataset for a single operational day', async () => {
  const useCase = createGetDailyCashFlow({
    reportRepository: {
      async listCashFlowDataset({ year, fromDate, toDate }) {
        assert.equal(year, 2026);
        assert.equal(fromDate.toISOString(), '2026-03-15T00:00:00.000Z');
        assert.equal(toDate.toISOString(), '2026-03-15T23:59:59.999Z');
        return {
          loans: [makeLoan({ amount: 40000000, startDate: '2026-03-15T14:00:00.000Z' })],
          payments: [makePayment({ amount: 50000000, interestApplied: 5000000, paymentDate: '2026-03-15T16:00:00.000Z' })],
          associatePayments: [makeAssociatePayment({ amount: 3000000, paidAt: '2026-03-15T17:00:00.000Z' })],
          operatingExpenses: [makeOperatingExpense({ amount: 2000000, expenseDate: '2026-03-15T18:00:00.000Z' })],
        };
      },
    },
  });

  const response = await useCase({
    actor: { role: 'admin' },
    filters: { date: '2026-03-15' },
  });

  assert.equal(response.success, true);
  assert.equal(response.data.filters.fromDate, '2026-03-15');
  assert.equal(response.data.filters.toDate, '2026-03-15');
  assert.equal(response.data.summary.totalAssociatePayments, '3000000.00');
  assert.equal(response.data.summary.availableCash, '5000000.00');
  assert.equal(response.data.days.length, 1);
  assert.equal(response.data.days[0].date, '2026-03-15');
});

test('createGetAnnualCashFlow reads canonical dataset for a year range', async () => {
  const useCase = createGetAnnualCashFlow({
    reportRepository: {
      async listCashFlowDataset({ year, fromDate, toDate }) {
        assert.equal(year, 2026);
        assert.equal(fromDate.toISOString(), '2024-01-01T00:00:00.000Z');
        assert.equal(toDate.toISOString(), '2026-12-31T23:59:59.999Z');
        return {
          loans: [makeLoan({ amount: 10000000, startDate: '2026-01-05T00:00:00.000Z' })],
          payments: [makePayment({ amount: 12000000, interestApplied: 2000000, paymentDate: '2026-02-05T00:00:00.000Z' })],
          associatePayments: [makeAssociatePayment({ amount: 500000, paidAt: '2026-03-05T00:00:00.000Z' })],
          operatingExpenses: [makeOperatingExpense({ amount: 300000, expenseDate: '2026-04-05T00:00:00.000Z' })],
        };
      },
    },
  });

  const response = await useCase({
    actor: { role: 'admin' },
    filters: { fromYear: '2024', toYear: '2026' },
  });

  assert.equal(response.success, true);
  assert.equal(response.data.filters.fromYear, 2024);
  assert.equal(response.data.filters.toYear, 2026);
  assert.equal(response.data.years.length, 3);
  assert.equal(response.data.years[2].year, '2026');
  assert.equal(response.data.years[2].availableCash, '1200000.00');
});

test('monthly cash flow Excel and PDF exports include operational fields', async () => {
  const dependencies = {
    reportRepository: {
      async listCashFlowDataset() {
        return {
          loans: [makeLoan({ amount: 40000000 })],
          payments: [makePayment({ amount: 50000000, principalApplied: 45000000, interestApplied: 4000000, penaltyApplied: 1000000 })],
          associatePayments: [makeAssociatePayment({ amount: 3000000 })],
          operatingExpenses: [makeOperatingExpense({ amount: 2000000 })],
        };
      },
    },
  };
  const excelUseCase = createExportMonthlyCashFlowExcel(dependencies);
  const pdfUseCase = createExportMonthlyCashFlowPdf(dependencies);

  const excel = await excelUseCase({ actor: { role: 'admin' }, year: 2026 });
  assert.equal(excel.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(excel.fileName, /flujo-caja-mensual-2026/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbookBuffer(excel.sheets));
  assert.ok(workbook.getWorksheet('Resumen Financiero'));
  assert.ok(workbook.getWorksheet('Historial Mensual'));
  const history = workbook.getWorksheet('Historial Mensual');
  const headers = history.getRow(2).values;
  assert.ok(headers.includes('Entradas por Cuotas'));
  assert.ok(headers.includes('Salidas por Préstamos'));
  assert.ok(headers.includes('Pagos a Socios'));
  assert.ok(headers.includes('Gastos Operativos'));
  assert.ok(headers.includes('Caja Disponible'));
  assert.equal(history.getRow(3).getCell(2).value, '$ 50.000.000,00');
  assert.equal(history.getRow(3).getCell(3).value, '$ 40.000.000,00');
  assert.equal(history.getRow(3).getCell(4).value, '$ 3.000.000,00');
  assert.equal(workbook.getWorksheet('Resumen Financiero').getRow(3).getCell(2).value, '$ 50.000.000,00');

  const pdf = await pdfUseCase({ actor: { role: 'admin' }, year: 2026 });
  assert.equal(pdf.contentType, 'application/pdf');
  assert.match(pdf.buffer.toString('utf8'), /%PDF-1.4/);
  assert.match(pdf.buffer.toString('utf8'), /Flujo de caja mensual 2026/);
  assert.match(pdf.buffer.toString('utf8'), /Pagos a socios: \$3000000.00/);
  assert.match(pdf.buffer.toString('utf8'), /Gastos operativos: \$2000000.00/);
});

test('reports router exposes monthly cash flow JSON, Excel and PDF routes with date filters', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: () => (req, _res, next) => {
      req.user = { id: 1, role: req.headers['x-test-role'] || 'admin' };
      next();
    },
    useCases: {
      async getMonthlyCashFlow({ actor, year, filters }) {
        calls.push(['json', actor.role, year, filters]);
        return { success: true, data: { year, summary: { availableCash: '10000.00' }, months: [] } };
      },
      async exportMonthlyCashFlowExcel({ actor, year, filters }) {
        calls.push(['excel', actor.role, year, filters]);
        return {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: 'flujo-caja-mensual-2026.xlsx',
          sheets: [{ name: 'Resumen Financiero', rows: [{ indicador: 'Caja disponible', valor: 10000 }] }],
        };
      },
      async exportMonthlyCashFlowPdf({ actor, year, filters }) {
        calls.push(['pdf', actor.role, year, filters]);
        return {
          contentType: 'application/pdf',
          fileName: 'flujo-caja-mensual-2026.pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const jsonResponse = await requestJson(activeServer, {
    path: '/cash-flow/monthly?year=2026&fromDate=2026-03-01&toDate=2026-03-31',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  assert.equal(jsonResponse.statusCode, 200);
  assert.equal(jsonResponse.body.data.summary.availableCash, '10000.00');

  const excelResponse = await requestBuffer(activeServer, {
    path: '/cash-flow/monthly/excel?year=2026&fromDate=2026-03-01&toDate=2026-03-31',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  assert.equal(excelResponse.statusCode, 200);
  assert.equal(excelResponse.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const pdfResponse = await requestBuffer(activeServer, {
    path: '/cash-flow/monthly/pdf?year=2026&fromDate=2026-03-01&toDate=2026-03-31',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  assert.equal(pdfResponse.statusCode, 200);
  assert.equal(pdfResponse.headers['content-type'], 'application/pdf');

  assert.deepEqual(calls, [
    ['json', 'admin', 2026, { fromDate: '2026-03-01', toDate: '2026-03-31' }],
    ['excel', 'admin', 2026, { fromDate: '2026-03-01', toDate: '2026-03-31' }],
    ['pdf', 'admin', 2026, { fromDate: '2026-03-01', toDate: '2026-03-31' }],
  ]);
});

test('reports router exposes daily cash flow JSON route with date filters', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: () => (req, _res, next) => {
      req.user = { id: 1, role: req.headers['x-test-role'] || 'admin' };
      next();
    },
    useCases: {
      async getDailyCashFlow({ actor, filters }) {
        calls.push([actor.role, filters]);
        return {
          success: true,
          data: {
            summary: { availableCash: '5000000.00' },
            days: [{ date: '2026-03-15', availableCash: '5000000.00' }],
          },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const jsonResponse = await requestJson(activeServer, {
    path: '/cash-flow/daily?date=2026-03-15',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(jsonResponse.statusCode, 200);
  assert.equal(jsonResponse.body.data.summary.availableCash, '5000000.00');
  assert.deepEqual(calls, [
    ['admin', { date: '2026-03-15', fromDate: undefined, toDate: undefined }],
  ]);
});

test('reports router exposes annual cash flow JSON route with year filters', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: ({ permissions }) => (req, res, next) => {
      req.user = { id: 1, role: 'admin', permissions };
      next();
    },
    useCases: {
      async getAnnualCashFlow(input) {
        calls.push(input);
        return { success: true, data: { filters: input.filters, years: [] } };
      },
    },
  });
  const app = express();
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/cash-flow/annual?fromYear=2024&toYear=2026',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0].filters, { fromYear: '2024', toYear: '2026' });
});
