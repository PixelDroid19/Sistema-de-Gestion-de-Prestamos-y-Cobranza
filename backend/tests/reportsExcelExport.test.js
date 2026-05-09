const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ExcelJS = require('exceljs');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { createExportCreditsExcel } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
const { createExportAssociatesExcel } = require('@/modules/reports/application/useCases/createExportAssociatesExcel');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');
const { closeServer, listen } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('export associates use case builds previous-system sheet structure', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'active',
    participationPercentage: 25,
  };
  const useCase = createExportAssociatesExcel({
    associateRepository: {
      async list() {
        return [associate];
      },
      async findById(id) {
        assert.equal(Number(id), 4);
        return associate;
      },
      async listContributionsByAssociate(id) {
        assert.equal(Number(id), 4);
        return [{ id: 1, amount: 1000000, contributionDate: '2026-01-10', status: 'completed', notes: 'Aporte inicial' }];
      },
      async listProfitDistributionsByAssociate(id) {
        assert.equal(Number(id), 4);
        return [{ id: 2, loanId: 9, amount: 150000, distributionDate: '2026-02-10', status: 'completed', distributionType: 'proportional' }];
      },
      async listLoansByAssociate(id) {
        assert.equal(Number(id), 4);
        return [{ id: 9, amount: 5000000, status: 'active', recoveryStatus: 'pending', customerId: 20, Customer: { name: 'Cliente QA' }, createdAt: '2026-01-11' }];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { role: 'admin' } });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.sheets.map((sheet) => sheet.name), [
    'Resumen General',
    'Distribución por Estado',
    'Creación por Mes',
    'Detalle de Socios',
    'Análisis de Rentabilidad',
    'Rangos de Inversión',
  ]);
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'ID Socio'));
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Participación %'));
});

test('export credits use case builds previous-system workbook fields with current snapshots', async () => {
  const loan = {
    id: 9,
    customerId: 20,
    amount: 5000000,
    interestRate: 60,
    termMonths: 2,
    status: 'active',
    recoveryStatus: 'pending',
    startDate: '2026-04-29T00:00:00.000Z',
    calculationMethod: 'FRENCH',
    policySnapshot: {
      ratePolicyLabel: 'QA tasa',
      lateFeePolicyLabel: 'QA mora',
    },
    Customer: {
      name: 'Cliente Excel QA',
      documentNumber: '100200300',
      phone: '3001234567',
      email: 'cliente@test.local',
      status: 'active',
    },
    Associate: { name: 'Socio QA' },
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-05-29T00:00:00.000Z',
        openingBalance: 5000000,
        scheduledPayment: 2600000,
        principalComponent: 2350000,
        interestComponent: 250000,
        paidPrincipal: 2350000,
        paidInterest: 250000,
        paidTotal: 2600000,
        remainingPrincipal: 0,
        remainingInterest: 0,
        remainingBalance: 2650000,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-06-29T00:00:00.000Z',
        openingBalance: 2650000,
        scheduledPayment: 2782500,
        principalComponent: 2650000,
        interestComponent: 132500,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        remainingPrincipal: 2650000,
        remainingInterest: 132500,
        remainingBalance: 0,
        status: 'pending',
      },
    ],
  };

  const useCase = createExportCreditsExcel({
    reportRepository: {
      async listOutstandingLoans() {
        return [loan];
      },
    },
    paymentRepository: {
      async listByLoan(loanId) {
        assert.equal(loanId, 9);
        return [{
          id: 1,
          status: 'completed',
          amount: 2600000,
          principalApplied: 2350000,
          interestApplied: 250000,
          penaltyApplied: 0,
          paymentType: 'installment',
          installmentNumber: 1,
          paymentDate: '2026-05-29T00:00:00.000Z',
          paymentMethod: 'cash',
          paymentMetadata: { reference: 'REC-1' },
        }];
      },
    },
    loanViewService: {
      getCanonicalLoanView(currentLoan) {
        return {
          schedule: currentLoan.emiSchedule,
          snapshot: {
            installmentAmount: 2600000,
            totalPayable: 5382500,
            totalInterest: 382500,
            outstandingPrincipal: 2650000,
            outstandingInterest: 132500,
            outstandingBalance: 2782500,
            nextInstallment: currentLoan.emiSchedule[1],
          },
        };
      },
    },
  });

  const result = await useCase({ actor: { role: 'admin' }, filters: { loanId: 9 } });

  assert.equal(result.success, true);
  assert.equal(result.data.rows[0].creditId, 9);
  assert.equal(result.data.rows[0].customerDocument, '100200300');
  assert.equal(result.data.rows[0].totalInterestPaid, 250000);
  assert.equal(result.data.rows[0].totalInterestGenerated, 382500);
  assert.equal(result.data.sheets[0].name, 'Resumen General');
  assert.equal(result.data.sheets[1].name, 'Detalle de Créditos');
  assert.equal(result.data.sheets[2].name, 'Crédito 9');
  assert.ok(result.data.sheets[2].sections.some((section) => section.title === 'TABLA DE AMORTIZACIÓN'));
  assert.ok(result.data.sheets[2].sections.some((section) => section.title === 'HISTORIAL DE PAGOS'));
  const detailHeaders = result.data.sheets[1].columns.map((column) => column.header);
  assert.ok(detailHeaders.includes('Interés Pagado'));
  assert.ok(detailHeaders.includes('Interés Generado'));
  assert.equal(detailHeaders.includes('calculationMethod'), false);
  assert.equal(detailHeaders.includes('ratePolicyId'), false);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbookBuffer(result.data.sheets));
  const summarySheet = workbook.getWorksheet('Resumen General');
  const detailSheet = workbook.getWorksheet('Detalle de Créditos');
  const creditSheet = workbook.getWorksheet('Crédito 9');

  const findRowByIndicator = (worksheet, indicator) => {
    let matchedRow = null;
    worksheet.eachRow((row) => {
      if (row.getCell(2).value === indicator) {
        matchedRow = row;
      }
    });
    return matchedRow;
  };

  const totalPrestadoRow = findRowByIndicator(summarySheet, 'Total Prestado (Capital)');
  assert.ok(totalPrestadoRow, 'Summary should include formatted capital total');
  assert.equal(totalPrestadoRow.getCell(3).value, 5000000);
  assert.match(totalPrestadoRow.getCell(3).numFmt, /\$/);

  const tnaRow = findRowByIndicator(summarySheet, 'TNA Promedio');
  assert.ok(tnaRow, 'Summary should include formatted TNA');
  assert.equal(tnaRow.getCell(3).value, 0.6);
  assert.equal(tnaRow.getCell(3).numFmt, '0.00%');

  const detailLoanDate = detailSheet.getRow(3).getCell(25);
  assert.ok(detailLoanDate.value instanceof Date, 'Detail loan date should be a real Excel date');
  assert.equal(detailLoanDate.numFmt, 'dd/mm/yyyy');

  let creditAmountRow = null;
  creditSheet.eachRow((row) => {
    if (row.getCell(1).value === 'Monto Préstamo') {
      creditAmountRow = row;
    }
  });
  assert.ok(creditAmountRow, 'Credit-specific sheet should include formatted credit amount');
  assert.equal(creditAmountRow.getCell(2).value, 5000000);
  assert.match(creditAmountRow.getCell(2).numFmt, /\$/);
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
        assert.deepEqual(input.filters, {
          customerId: undefined,
          loanId: '1',
          creditId: undefined,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        });
        return {
          success: true,
          data: {
            rows: mockLoans.map(l => ({
              loanId: l.id,
              customerName: l.Customer.name,
              amount: l.amount,
              status: l.status,
            })),
            sheets: [
              {
                name: 'Resumen General',
                columns: [
                  { header: 'Seccion', key: 'section' },
                  { header: 'Indicador', key: 'indicator' },
                  { header: 'Valor', key: 'value' },
                ],
                rows: [{ section: 'INFORMACION GENERAL', indicator: 'Total de Creditos', value: 2 }],
              },
              {
                name: 'Detalle de Créditos',
                title: 'DETALLE DE CRÉDITOS',
                columns: [
                  { header: 'ID Crédito', key: 'creditId' },
                  { header: 'Cliente', key: 'customerName' },
                  { header: 'Interés Pagado', key: 'totalInterestPaid' },
                  { header: 'Interés Generado', key: 'totalInterestGenerated' },
                ],
                rows: [{ creditId: 1, customerName: 'Juan', totalInterestPaid: 1000, totalInterestGenerated: 3000 }],
              },
              {
                name: 'Crédito 1',
                sections: [
                  {
                    title: 'TABLA DE AMORTIZACIÓN',
                    columns: [
                      { header: 'Número de Cuota', key: 'installmentNumber' },
                      { header: 'CUOTA A PAGAR', key: 'scheduledPayment' },
                    ],
                    rows: [{ installmentNumber: 1, scheduledPayment: 10000 }],
                  },
                ],
              },
            ],
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/credits/excel?loanId=1&startDate=2026-01-01&endDate=2026-01-31`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(response.headers.get('content-disposition') || '', /reporte-creditos-credito-1-/);

  const arrayBuffer = await response.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 0, 'Should return non-empty buffer');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(arrayBuffer));
  assert.ok(workbook.getWorksheet('Resumen General'));
  assert.ok(workbook.getWorksheet('Detalle de Créditos'));
  assert.ok(workbook.getWorksheet('Crédito 1'));

  const detailHeaders = workbook.getWorksheet('Detalle de Créditos').getRow(2).values;
  assert.ok(detailHeaders.includes('Interés Pagado'));
  assert.ok(detailHeaders.includes('Interés Generado'));
  assert.equal(detailHeaders.includes('loanId'), false);
  assert.equal(detailHeaders.includes('calculationMethod'), false);
});

test('GET /reports/payouts/excel returns xlsx file for admin', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportPayoutsExcel(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          customerId: '10',
          loanId: undefined,
          creditId: undefined,
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          status: undefined,
          paymentType: undefined,
        });
        return {
          success: true,
          data: {
            rows: [{ paymentId: 7, loanId: 4, customerName: 'Ana', amount: '100.00' }],
          },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/payouts/excel?customerId=10&startDate=2026-02-01&endDate=2026-02-28`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(response.headers.get('content-disposition') || '', /reporte-pagos-cliente-10-/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const headers = workbook.getWorksheet('Pagos').getRow(2).values;
  assert.ok(headers.includes('ID Pago'));
  assert.ok(headers.includes('Interés Aplicado'));
  assert.equal(headers.includes('paymentId'), false);
  assert.equal(headers.includes('paymentMetadata'), false);
});

test('GET /reports/dashboard/excel returns xlsx file for admin', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getDashboardSummary(input) {
        assert.equal(input.actor.role, 'admin');
        return {
          success: true,
          data: {
            summary: {
              totalLoans: 4,
              activeLoans: 3,
              defaultedLoans: 1,
              recoveredLoans: 2,
              totalPortfolioAmount: '400000.00',
              totalInterestGenerated: '98000.00',
              totalInterestPaid: '62000.00',
              totalRecoveredAmount: '210000.00',
              totalOutstandingAmount: '190000.00',
            },
            collections: {
              overdueAlerts: 1,
              pendingPromises: 2,
              unreadNotifications: 3,
            },
            monthlyPerformance: [
              { month: '2026-03', disbursed: 100000, recovered: 80000 },
            ],
            recentActivity: {
              loans: [{
                loanId: 4,
                customerName: 'QA Cliente',
                status: 'active',
                Customer: { name: 'QA Cliente' },
                rowVersion: BigInt(2),
              }],
              payments: [{
                paymentId: 10,
                amount: '50000.00',
                metadata: { paymentMethod: 'cash' },
                circular: null,
              }],
              alerts: [],
              promises: [],
              notifications: [],
            },
          },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/dashboard/excel`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(response.headers.get('content-disposition') || '', /dashboard-report-/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const headers = workbook.getWorksheet('Resumen General').getRow(2).values;
  assert.ok(headers.includes('Indicador'));
  assert.ok(headers.includes('Valor'));
  assert.equal(headers.includes('totalLoans'), false);
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

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const headers = workbook.getWorksheet('Detalle de Socios').getRow(2).values;
  assert.ok(headers.includes('ID Socio'));
  assert.ok(headers.includes('Participación %'));
  assert.equal(headers.includes('associateId'), false);
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
