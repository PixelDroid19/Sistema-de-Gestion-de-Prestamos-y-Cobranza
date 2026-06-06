const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ExcelJS = require('exceljs');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');
const {
  buildCreditHistoryAuditReport,
  createGetCreditHistoryAuditReport,
  createListCreditHistoryFinancialProducts,
  createExportCreditHistoryAuditExcel,
  createExportCreditHistoryAuditPdf,
} = require('@/modules/reports/application/useCases/createCreditHistoryAuditReport');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const makeLoan = (overrides = {}) => ({
  id: overrides.id || 1,
  customerId: overrides.customerId || 10,
  amount: overrides.amount ?? 0,
  status: overrides.status || 'active',
  startDate: overrides.startDate || '2026-01-05T00:00:00.000Z',
  createdAt: overrides.createdAt || overrides.startDate || '2026-01-05T00:00:00.000Z',
  principalOutstanding: overrides.principalOutstanding ?? 0,
  financialSnapshot: overrides.financialSnapshot || {},
  Customer: overrides.Customer || { name: 'Cliente QA' },
  ...overrides,
});

const makePayment = (overrides = {}) => ({
  id: overrides.id || 1,
  loanId: overrides.loanId || 1,
  amount: overrides.amount ?? 0,
  principalApplied: overrides.principalApplied ?? 0,
  interestApplied: overrides.interestApplied ?? 0,
  penaltyApplied: overrides.penaltyApplied ?? 0,
  status: overrides.status || 'completed',
  paymentType: overrides.paymentType || 'installment',
  paymentDate: overrides.paymentDate || '2026-01-10T00:00:00.000Z',
  Loan: overrides.Loan || { id: overrides.loanId || 1, customerId: 10, Customer: { name: 'Cliente QA' } },
  ...overrides,
});

const requestBuffer = (server, { path, headers = {} }) => new Promise((resolve, reject) => {
  const { port } = server.address();
  const request = require('node:http').request({
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

test('buildCreditHistoryAuditReport reconciles monthly audit totals for loans and completed payments', () => {
  const report = buildCreditHistoryAuditReport({
    filters: {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-02-28T23:59:59.999Z'),
    },
    loans: [
      makeLoan({ id: 1, amount: 40000000, status: 'active', startDate: '2026-01-04T00:00:00.000Z' }),
      makeLoan({ id: 2, amount: 10000000, status: 'defaulted', startDate: '2026-02-05T00:00:00.000Z', principalOutstanding: 7000000 }),
    ],
    payments: [
      makePayment({ id: 10, amount: 50000000, principalApplied: 45000000, interestApplied: 4000000, penaltyApplied: 1000000, paymentDate: '2026-01-20T00:00:00.000Z' }),
      makePayment({ id: 11, amount: 8000000, principalApplied: 7000000, interestApplied: 1000000, penaltyApplied: 0, paymentDate: '2026-02-20T00:00:00.000Z' }),
    ],
  });

  assert.equal(report.summary.creditsCreated, 2);
  assert.equal(report.summary.installmentsReceived, 2);
  assert.equal(report.summary.totalPrincipalCreated, '50000000.00');
  assert.equal(report.summary.totalPaymentsReceived, '58000000.00');
  assert.equal(report.summary.totalCapitalRecovered, '52000000.00');
  assert.equal(report.summary.totalPrincipalOutstanding, '0.00');
  assert.equal(report.summary.totalInterestCollected, '5000000.00');
  assert.equal(report.summary.totalPenaltiesCollected, '1000000.00');
  assert.equal(report.summary.overdueCredits, 1);
  assert.equal(report.summary.lossesAtRisk, '7000000.00');
  assert.equal(report.summary.gains, '6000000.00');
  assert.equal(report.summary.availableCash, '8000000.00');

  assert.equal(report.months[0].month, '2026-01');
  assert.equal(report.months[0].availableCash, '10000000.00');
  assert.equal(report.months[1].month, '2026-02');
  assert.equal(report.months[1].availableCash, '8000000.00');
});

test('buildCreditHistoryAuditReport reconciles caja solo con créditos y gastos operativos', () => {
  const report = buildCreditHistoryAuditReport({
    filters: {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
    },
    loans: [
      makeLoan({ id: 1, amount: 40000000, status: 'active', startDate: '2026-01-04T00:00:00.000Z' }),
    ],
    payments: [
      makePayment({ id: 10, amount: 50000000, principalApplied: 45000000, interestApplied: 4000000, penaltyApplied: 1000000, paymentDate: '2026-01-20T00:00:00.000Z' }),
    ],
    operatingExpenses: [
      { id: 30, amount: 1500000, status: 'completed', expenseDate: '2026-01-28T00:00:00.000Z' },
      { id: 31, amount: 700000, status: 'annulled', expenseDate: '2026-01-29T00:00:00.000Z' },
    ],
  });

  assert.equal(report.summary.totalOperatingExpenses, '1500000.00');
  assert.equal(report.summary.availableCash, '8500000.00');
  assert.equal(report.months[0].operatingExpenses, '1500000.00');
  assert.equal(report.months[0].availableCash, '8500000.00');
});

test('credit history detail reconciles paid interest from canonical payments and does not count capital payments as received installments', () => {
  const report = buildCreditHistoryAuditReport({
    filters: {
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T23:59:59.999Z'),
    },
    loans: [
      makeLoan({
        id: 1,
        amount: 2000000,
        startDate: '2026-06-01T00:00:00.000Z',
        principalOutstanding: 1390805,
        financialSnapshot: {
          totalPaid: 669195,
          totalPaidInterest: 60000,
        },
      }),
    ],
    payments: [
      makePayment({
        id: 1,
        loanId: 1,
        amount: 369195,
        principalApplied: 309195,
        interestApplied: 60000,
        paymentType: 'installment',
        paymentDate: '2026-06-02T00:00:00.000Z',
      }),
      makePayment({
        id: 2,
        loanId: 1,
        amount: 300000,
        principalApplied: 300000,
        interestApplied: 0,
        paymentType: 'capital',
        paymentDate: '2026-06-10T00:00:00.000Z',
      }),
    ],
  });

  assert.equal(report.summary.installmentsReceived, 1);
  assert.equal(report.summary.totalPaymentsReceived, '669195.00');
  assert.equal(report.credits[0].totalPaid, 669195);
  assert.equal(report.credits[0].interestPaid, 60000);
  assert.equal(report.credits[0].penaltyPaid, 0);
});

test('credit history audit use case passes normalized month, date and status filters to canonical repository', async () => {
  const useCase = createGetCreditHistoryAuditReport({
    reportRepository: {
      async listCreditHistoryDataset(filters) {
        assert.equal(filters.month, '2026-04');
        assert.deepEqual(filters.status, ['active', 'overdue']);
        assert.equal(filters.startDate.toISOString().slice(0, 10), '2026-04-01');
        assert.equal(filters.endDate.toISOString().slice(0, 10), '2026-04-30');
        return {
          loans: [makeLoan({ amount: 2000000, startDate: '2026-04-03T00:00:00.000Z' })],
          payments: [makePayment({ amount: 3000000, principalApplied: 2500000, interestApplied: 500000, paymentDate: '2026-04-22T00:00:00.000Z' })],
        };
      },
    },
  });

  const response = await useCase({
    actor: { role: 'admin' },
    filters: { month: '2026-04', status: 'active,overdue' },
  });

  assert.equal(response.success, true);
  assert.equal(response.data.summary.totalPaymentsReceived, '3000000.00');
});

test('credit history audit use case rejects malformed month filters with operational messages', async () => {
  const useCase = createGetCreditHistoryAuditReport({
    reportRepository: {
      async listCreditHistoryDataset() {
        throw new Error('repository should not be called for malformed month filters');
      },
    },
  });

  await assert.rejects(
    () => useCase({ actor: { role: 'admin' }, filters: { month: '2026-13' } }),
    (error) => {
      assert.equal(error.message, 'El mes del reporte debe usar el formato AAAA-MM.');
      return true;
    },
  );
});

test('credit history audit use case passes normalized customer and credit filters to canonical repository', async () => {
  const useCase = createGetCreditHistoryAuditReport({
    reportRepository: {
      async listCreditHistoryDataset(filters) {
        assert.equal(filters.customerId, 7);
        assert.equal(filters.loanId, 15);
        assert.equal(filters.financialProductId, '11111111-1111-4111-8111-111111111111');
        return {
          loans: [makeLoan({ id: 15, customerId: 7, amount: 1200000, startDate: '2026-05-03T00:00:00.000Z' })],
          payments: [makePayment({
            loanId: 15,
            amount: 400000,
            principalApplied: 300000,
            interestApplied: 100000,
            paymentDate: '2026-05-20T00:00:00.000Z',
            Loan: { id: 15, customerId: 7, Customer: { name: 'Cliente filtrado' } },
          })],
        };
      },
    },
  });

  const response = await useCase({
    actor: { role: 'admin' },
    filters: {
      customerId: '7',
      loanId: '15',
      financialProductId: '11111111-1111-4111-8111-111111111111',
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.data.credits[0].creditId, 15);
  assert.equal(response.data.payments[0].creditId, 15);
});

test('credit history financial products use case returns canonical product options for report filters', async () => {
  const useCase = createListCreditHistoryFinancialProducts({
    reportRepository: {
      async listCreditHistoryFinancialProducts() {
        return [
          { id: 'prod-personal', name: 'Crédito personal' },
          { id: 'prod-comercial', name: 'Crédito comercial' },
        ];
      },
    },
  });

  const response = await useCase({ actor: { role: 'employee' } });

  assert.equal(response.success, true);
  assert.deepEqual(response.data.financialProducts, [
    { id: 'prod-personal', name: 'Crédito personal' },
    { id: 'prod-comercial', name: 'Crédito comercial' },
  ]);
});

test('credit history audit Excel and PDF exports include Spanish operational fields and no CSV payload', async () => {
  const dependencies = {
    reportRepository: {
      async listCreditHistoryDataset() {
        return {
          loans: [makeLoan({ amount: 2000000 })],
          payments: [makePayment({ amount: 2000000, principalApplied: 1500000, interestApplied: 500000 })],
          operatingExpenses: [
            { id: 30, amount: 100000, status: 'completed', expenseDate: '2026-01-21T00:00:00.000Z' },
          ],
        };
      },
    },
  };

  const excel = await createExportCreditHistoryAuditExcel(dependencies)({ actor: { role: 'admin' }, filters: { startDate: '2026-01-01', endDate: '2026-01-31' } });
  assert.equal(excel.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.doesNotMatch(excel.fileName, /\.csv$/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbookBuffer(excel.sheets));
  assert.ok(workbook.getWorksheet('Resumen Auditoría'));
  assert.ok(workbook.getWorksheet('Historial Mensual'));
  assert.ok(workbook.getWorksheet('Detalle Créditos'));
  assert.ok(workbook.getWorksheet('Detalle Pagos'));

  const headers = workbook.getWorksheet('Historial Mensual').getRow(2).values;
  assert.ok(headers.includes('Créditos Creados'));
  assert.ok(headers.includes('Cuotas Recibidas'));
  assert.ok(headers.includes('Gastos Operativos'));
  assert.ok(headers.includes('Intereses Cobrados'));
  assert.ok(headers.includes('Capital Recuperado'));
  assert.ok(headers.includes('Créditos Vencidos'));
  assert.ok(headers.includes('Pérdidas/Riesgo'));
  assert.ok(headers.includes('Ganancias'));
  assert.ok(headers.includes('Caja Disponible'));

  const historySheet = workbook.getWorksheet('Historial Mensual');
  const firstCapitalCell = historySheet.getRow(3).getCell(3);
  const firstReceivedCell = historySheet.getRow(3).getCell(5);
  const firstGainsCell = historySheet.getRow(3).getCell(12);
  const firstAvailableCashCell = historySheet.getRow(3).getCell(13);
  assert.equal(firstCapitalCell.value, 2000000);
  assert.equal(firstReceivedCell.value, 2000000);
  assert.equal(firstGainsCell.value, 500000);
  assert.equal(firstAvailableCashCell.value, -100000);
  assert.equal(typeof firstCapitalCell.value, 'number');
  assert.match(firstCapitalCell.numFmt, /\$/);
  assert.match(firstGainsCell.numFmt, /\$/);
  assert.match(firstAvailableCashCell.numFmt, /\$/);

  const summarySheet = workbook.getWorksheet('Resumen Auditoría');
  let capitalVivoRow = null;
  summarySheet.eachRow((row) => {
    if (row.getCell(1).value === 'Capital vivo') {
      capitalVivoRow = row;
    }
  });
  assert.ok(capitalVivoRow, 'Resumen Auditoría should include Capital vivo');
  assert.equal(capitalVivoRow.getCell(2).value, 500000);
  assert.match(capitalVivoRow.getCell(2).numFmt, /\$/);

  const pdf = await createExportCreditHistoryAuditPdf(dependencies)({ actor: { role: 'admin' }, filters: {} });
  assert.equal(pdf.contentType, 'application/pdf');
  assert.doesNotMatch(pdf.fileName, /\.csv$/);
  assert.match(pdf.buffer.toString('utf8'), /%PDF-1.4/);
  assert.match(pdf.buffer.toString('utf8'), /Historial de créditos/);
  assert.match(pdf.buffer.toString('utf8'), /Gastos operativos/);
  assert.match(pdf.buffer.toString('utf8'), /Detalle mensual/);
  assert.match(pdf.buffer.toString('utf8'), /2026-01 - prestado 2000000.00 - recibido 2000000.00 - gastos 100000.00 - caja -100000.00/);
});

test('reports router exposes advanced credit history JSON, Excel and PDF routes', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: () => (req, _res, next) => {
      req.user = { id: 1, role: 'admin' };
      next();
    },
    useCases: {
      async listCreditHistoryFinancialProducts({ actor }) {
        calls.push(['catalog', actor.role]);
        return {
          success: true,
          data: {
            financialProducts: [{ id: 'prod-personal', name: 'Crédito personal' }],
          },
        };
      },
      async getCreditHistoryAuditReport({ actor, filters }) {
        calls.push(['json', actor.role, filters.status, filters.customerId, filters.loanId, filters.financialProductId]);
        return { success: true, data: { summary: { availableCash: '1000.00' }, months: [] } };
      },
      async exportCreditHistoryAuditExcel({ actor, filters }) {
        calls.push(['excel', actor.role, filters.status, filters.customerId, filters.loanId, filters.financialProductId]);
        return {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: 'historial-creditos-2026-01-01-2026-01-31.xlsx',
          sheets: [{ name: 'Resumen Auditoría', rows: [{ indicador: 'Caja disponible', valor: 1000 }] }],
        };
      },
      async exportCreditHistoryAuditPdf({ actor, filters }) {
        calls.push(['pdf', actor.role, filters.status, filters.customerId, filters.loanId, filters.financialProductId]);
        return {
          contentType: 'application/pdf',
          fileName: 'historial-creditos-2026-01-01-2026-01-31.pdf',
          buffer: Buffer.from('%PDF-1.4 test', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const catalogResponse = await requestJson(activeServer, {
    path: '/credit-history/financial-products',
    headers: { authorization: 'Bearer valid-token' },
  });
  assert.equal(catalogResponse.statusCode, 200);
  assert.deepEqual(catalogResponse.body.data.financialProducts, [{ id: 'prod-personal', name: 'Crédito personal' }]);

  const jsonResponse = await requestJson(activeServer, {
    path: '/credit-history/monthly?startDate=2026-01-01&endDate=2026-01-31&status=active&customerId=7&loanId=15&financialProductId=11111111-1111-4111-8111-111111111111',
    headers: { authorization: 'Bearer valid-token' },
  });
  assert.equal(jsonResponse.statusCode, 200);
  assert.equal(jsonResponse.body.data.summary.availableCash, '1000.00');

  const excelResponse = await requestBuffer(activeServer, {
    path: '/credit-history/monthly/export?format=xlsx&startDate=2026-01-01&endDate=2026-01-31&status=active&customerId=7&loanId=15&financialProductId=11111111-1111-4111-8111-111111111111',
    headers: { authorization: 'Bearer valid-token' },
  });
  assert.equal(excelResponse.statusCode, 200);
  assert.equal(excelResponse.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(excelResponse.headers['content-disposition'] || '', /\.xlsx/);

  const pdfResponse = await requestBuffer(activeServer, {
    path: '/credit-history/monthly/export?format=pdf&startDate=2026-01-01&endDate=2026-01-31&status=active&customerId=7&loanId=15&financialProductId=11111111-1111-4111-8111-111111111111',
    headers: { authorization: 'Bearer valid-token' },
  });
  assert.equal(pdfResponse.statusCode, 200);
  assert.equal(pdfResponse.headers['content-type'], 'application/pdf');
  assert.match(pdfResponse.headers['content-disposition'] || '', /\.pdf/);

  assert.deepEqual(calls, [
    ['catalog', 'admin'],
    ['json', 'admin', 'active', '7', '15', '11111111-1111-4111-8111-111111111111'],
    ['excel', 'admin', 'active', '7', '15', '11111111-1111-4111-8111-111111111111'],
    ['pdf', 'admin', 'active', '7', '15', '11111111-1111-4111-8111-111111111111'],
  ]);
});
