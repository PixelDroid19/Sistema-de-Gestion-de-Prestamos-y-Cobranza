const { test, afterEach } = require('node:test');
const { extractPdfText } = require('./helpers/pdfText');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const ExcelJS = require('exceljs');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');
const {
  buildMonthlyCashFlowReport,
  createGetMonthlyCashFlow,
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
      makeLoan({ id: 1, amount: 40000000, status: 'active', principalOutstanding: 12000000, startDate: '2026-01-02T00:00:00.000Z' }),
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
  assert.equal(report.summary.portfolioReceivable, '19000000.00');
  assert.equal(report.summary.totalPrincipalRecovered, '52000000.00');
  assert.equal(report.summary.totalCollectedProfit, '6000000.00');
  assert.equal(report.summary.lossesAtRisk, '7000000.00');
  assert.equal(report.summary.netProfitIndicator, '-1000000.00');

  assert.equal(report.months[0].month, '2026-01');
  assert.equal(report.months[0].inflows, '50000000.00');
  assert.equal(report.months[0].outflows, '40000000.00');
  assert.equal(report.months[0].availableCash, '10000000.00');
  assert.equal(report.months[0].portfolioReceivable, '12000000.00');
  assert.equal(report.months[0].principalRecovered, '45000000.00');
  assert.equal(report.months[0].collectedProfit, '5000000.00');

  assert.equal(report.months[1].month, '2026-02');
  assert.equal(report.months[1].inflows, '8000000.00');
  assert.equal(report.months[1].outflows, '10000000.00');
  assert.equal(report.months[1].availableCash, '8000000.00');
  assert.equal(report.months[1].portfolioReceivable, '7000000.00');
  assert.equal(report.months[1].principalRecovered, '7000000.00');
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

test('buildMonthlyCashFlowReport reconciles cash contributions, reinvestments, and capital returns separately', () => {
  const report = buildMonthlyCashFlowReport({
    year: 2026,
    associateContributions: [
      { id: 1, amount: 10000000, contributionDate: '2026-01-05' },
      { id: 2, amount: 1000000, contributionDate: '2026-01-20' },
    ],
    associateReinvestments: [
      { id: 3, amount: 1000000, distributionDate: '2026-01-20' },
    ],
    associateCapitalReturns: [
      { id: 4, amount: 2000000, distributionDate: '2026-02-10' },
    ],
  });

  assert.equal(report.summary.totalAssociateContributions, '10000000.00');
  assert.equal(report.summary.totalCapitalReturns, '2000000.00');
  assert.equal(report.summary.availableCash, '8000000.00');
  assert.equal(report.months[0].associateContributions, '10000000.00');
  assert.equal(report.months[0].availableCash, '10000000.00');
  assert.equal(report.months[1].capitalReturns, '2000000.00');
  assert.equal(report.months[1].availableCash, '8000000.00');
  assert.equal(report.summary.netProfitIndicator, '0.00');
});

test('buildMonthlyCashFlowReport identifies who owns every accounting movement', () => {
  const report = buildMonthlyCashFlowReport({
    year: 2026,
    loans: [
      makeLoan({
        id: 31,
        amount: 2000000,
        startDate: '2026-07-10T00:00:00.000Z',
        Customer: { id: 8, name: 'Cliente Contable' },
      }),
    ],
    payments: [
      makePayment({
        id: 41,
        loanId: 31,
        amount: 300000,
        paymentDate: '2026-07-24T00:00:00.000Z',
        Loan: { id: 31, Customer: { id: 8, name: 'Cliente Contable' } },
      }),
    ],
    associateContributions: [{
      id: 51,
      associateId: 12,
      amount: 1000000,
      contributionDate: '2026-07-05T00:00:00.000Z',
      Associate: { id: 12, name: 'Socio Contable' },
    }],
    associatePayments: [{
      id: 61,
      associateId: 12,
      amount: 50000,
      paidAt: '2026-07-25T00:00:00.000Z',
      Associate: { id: 12, name: 'Socio Contable' },
    }],
    operatingExpenses: [
      makeOperatingExpense({
        id: 71,
        amount: 80000,
        expenseDate: '2026-07-28T00:00:00.000Z',
        description: 'Servicio contable',
        category: 'Administración',
        createdBy: { id: 3, name: 'Operador Contable' },
      }),
    ],
  });

  assert.deepEqual(report.movements.map((movement) => ({
    movementType: movement.movementType,
    counterpartyName: movement.counterpartyName,
    reference: movement.reference,
    inflow: movement.inflow,
    outflow: movement.outflow,
  })), [
    {
      movementType: 'associate_contribution',
      counterpartyName: 'Socio Contable',
      reference: 'Aporte #51',
      inflow: '1000000.00',
      outflow: '0.00',
    },
    {
      movementType: 'loan_disbursement',
      counterpartyName: 'Cliente Contable',
      reference: 'Crédito #31',
      inflow: '0.00',
      outflow: '2000000.00',
    },
    {
      movementType: 'customer_payment',
      counterpartyName: 'Cliente Contable',
      reference: 'Crédito #31 · Pago #41',
      inflow: '300000.00',
      outflow: '0.00',
    },
    {
      movementType: 'associate_payment',
      counterpartyName: 'Socio Contable',
      reference: 'Pago a socio #61',
      inflow: '0.00',
      outflow: '50000.00',
    },
    {
      movementType: 'operating_expense',
      counterpartyName: 'Servicio contable',
      reference: 'Gasto #71 · Administración',
      inflow: '0.00',
      outflow: '80000.00',
    },
  ]);
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
  assert.deepEqual(response.data.months.map((month) => month.month), ['2026-03']);
  assert.equal(response.data.months[0].availableCash, '4500000.00');
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
  assert.match(excel.fileName, /cierre-contable-mensual-2026/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbookBuffer(excel.sheets));
  assert.ok(workbook.getWorksheet('Resumen Financiero'));
  assert.ok(workbook.getWorksheet('Créditos y Pagos'));
  const history = workbook.getWorksheet('Créditos y Pagos');
  const headers = history.getRow(2).values;
  assert.ok(headers.includes('Entradas por Cuotas'));
  assert.ok(headers.includes('Aportes de Socios'));
  assert.ok(headers.includes('Salidas por Préstamos'));
  assert.ok(headers.includes('Pagos a Socios'));
  assert.ok(headers.includes('Devoluciones de Capital'));
  assert.ok(headers.includes('Gastos Operativos'));
  assert.ok(headers.includes('Caja Disponible'));
  assert.equal(history.getRow(3).getCell(2).value, 'COP 50.000.000,00');
  assert.equal(history.getRow(3).getCell(3).value, 'COP 0,00');
  assert.equal(history.getRow(3).getCell(4).value, 'COP 40.000.000,00');
  assert.equal(history.getRow(3).getCell(5).value, 'COP 3.000.000,00');
  assert.equal(history.getRow(3).getCell(6).value, 'COP 0,00');
  assert.equal(workbook.getWorksheet('Resumen Financiero').getRow(3).getCell(2).value, 'COP 50.000.000,00');

  const pdf = await pdfUseCase({ actor: { role: 'admin' }, year: 2026 });
  assert.equal(pdf.contentType, 'application/pdf');
  assert.match(pdf.buffer.toString('latin1'), /%PDF-1\.\d/);
  assert.match(pdf.buffer.toString('latin1'), /\/MediaBox \[0 0 792 612\]/);
  const pdfText = extractPdfText(pdf.buffer);
  assert.match(pdfText, /Cierre contable 2026/);
  assert.match(pdfText, /pagos a socios/i);
  assert.match(pdfText, /COP 3.000.000,00/);
  assert.match(pdfText, /gastos del negocio/i);
  assert.match(pdfText, /Socios/);
  assert.match(pdfText, /Gastos/);
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
          fileName: 'cierre-contable-mensual-2026.xlsx',
          sheets: [{ name: 'Resumen Financiero', rows: [{ indicador: 'Caja disponible', valor: 10000 }] }],
        };
      },
      async exportMonthlyCashFlowPdf({ actor, year, filters }) {
        calls.push(['pdf', actor.role, year, filters]);
        return {
          contentType: 'application/pdf',
          fileName: 'cierre-contable-mensual-2026.pdf',
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
