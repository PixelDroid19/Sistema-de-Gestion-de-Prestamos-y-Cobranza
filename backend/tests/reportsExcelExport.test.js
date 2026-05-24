const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ExcelJS = require('exceljs');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { createExportCreditsExcel } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
const { createExportPayoutsExcel } = require('@/modules/reports/application/useCases/createExportPayoutsExcel');
const { createExportAssociatesExcel, createExportAssociatesPdf } = require('@/modules/reports/application/useCases/createExportAssociatesExcel');
const { formatOperationalStatus, formatPaymentMethod, formatPaymentType } = require('@/modules/reports/application/reportLabels');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');
const { closeServer, listen } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('report labels use operational fallbacks instead of raw enum-like values', () => {
  assert.equal(formatOperationalStatus('manual_hold'), 'Estado no clasificado');
  assert.equal(formatPaymentType('adjustment_fee'), 'Tipo de pago no clasificado');
  assert.equal(formatPaymentMethod('wallet_mobile'), 'Método no clasificado');
});

test('export associates use case builds approved operational sheet structure', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'active',
    participationPercentage: 25,
    interestType: 'monthly',
    interestRate: '2.5000',
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
        return [{
          id: 1,
          amount: 1000000,
          contributionDate: '2026-01-10',
          status: 'completed',
          interestTypeSnapshot: 'monthly',
          interestRateSnapshot: '2.5000',
          notes: 'Aporte inicial',
        }];
      },
      async listProfitDistributionsByAssociate(id) {
        assert.equal(Number(id), 4);
        return [{ id: 2, loanId: 9, amount: 150000, distributionDate: '2026-02-10', status: 'completed', distributionType: 'proportional' }];
      },
      async findInstallmentsByAssociateId(id) {
        assert.equal(Number(id), 4);
        return [
          { id: 3, installmentNumber: 1, amount: 25000, dueDate: '2026-02-15', status: 'paid', paidAt: '2026-02-16', paymentMethod: 'transfer' },
          { id: 4, installmentNumber: 2, amount: 25000, dueDate: '2000-03-15', status: 'pending' },
        ];
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
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Tipo de Interés'));
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Deuda con Socio'));
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Rentabilidad del Aporte'));
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Tasa Histórica del Aporte %'));
  assert.ok(result.data.rows.some((row) => row.section === 'Interés pagado'));
  assert.ok(result.data.rows.some((row) => row.section === 'Interés pendiente'));
  assert.ok(result.data.rows.some((row) => row.section === 'Interés pendiente' && row.status === 'Vencido'));
  assert.ok(result.data.rows.some((row) => row.section === 'Aporte'));
  assert.ok(result.data.rows.some((row) => row.section === 'Aporte' && row.contributionInterestType === 'Mensual' && row.contributionInterestRate === '2.5000'));
  assert.ok(result.data.rows.some((row) => row.section === 'Distribución'));
  assert.equal(result.data.rows.some((row) => /contribution|distribution|Distributed|Interest installments/i.test(`${row.section} ${row.date} ${row.notes}`)), false);
});

test('export associates PDF summarizes associate payments, pending interest, and schedule', async () => {
  const associate = {
    id: 4,
    name: 'Socio PDF QA',
    status: 'active',
    participationPercentage: 25,
    interestType: 'monthly',
    interestRate: '2.5000',
  };
  const useCase = createExportAssociatesPdf({
    associateRepository: {
      async list() {
        return [associate];
      },
      async findById(id) {
        assert.equal(Number(id), 4);
        return associate;
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000000, contributionDate: '2026-01-10', status: 'completed', interestTypeSnapshot: 'monthly', interestRateSnapshot: '2.5000' }];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [
          { id: 3, installmentNumber: 1, amount: 25000, dueDate: '2026-02-15', status: 'paid', paidAt: '2026-02-16', paymentMethod: 'transfer' },
          { id: 4, installmentNumber: 2, amount: 25000, dueDate: '2099-03-15', status: 'pending' },
        ];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { role: 'admin' } });
  const pdfText = result.buffer.toString('utf8');

  assert.equal(result.fileName, 'associates-export.pdf');
  assert.equal(result.contentType, 'application/pdf');
  assert.match(pdfText, /REPORTE DE SOCIOS INVERSIONISTAS/);
  assert.match(pdfText, /Pagos realizados a socios: \$25,000\.00/);
  assert.match(pdfText, /Intereses pendientes de socios: \$25,000\.00/);
  assert.match(pdfText, /Cronograma de pagos de socios: 1 cuota/);
  assert.match(pdfText, /Socio PDF QA/);
});

test('export associates use case filters the operational report by associate id', async () => {
  const associate = {
    id: 8,
    name: 'Socio Filtrado QA',
    status: 'active',
    participationPercentage: 40,
    interestType: 'annual',
    interestRate: '12.0000',
  };
  const useCase = createExportAssociatesExcel({
    associateRepository: {
      async list() {
        throw new Error('The global associates list should not be used for a single-associate export');
      },
      async findById(id) {
        assert.equal(Number(id), 8);
        return associate;
      },
      async listContributionsByAssociate(id) {
        assert.equal(Number(id), 8);
        return [{ id: 20, amount: 2500000, contributionDate: '2026-04-01', status: 'completed', interestTypeSnapshot: 'annual', interestRateSnapshot: '12.0000' }];
      },
      async listProfitDistributionsByAssociate(id) {
        assert.equal(Number(id), 8);
        return [];
      },
      async findInstallmentsByAssociateId(id) {
        assert.equal(Number(id), 8);
        return [];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { role: 'admin' }, filters: { associateId: 8 } });

  assert.equal(result.success, true);
  assert.equal(new Set(result.data.rows.map((row) => row.associateId)).size, 1);
  assert.equal(result.data.rows[0].associateId, 8);
  assert.equal(result.data.rows[0].associateName, 'Socio Filtrado QA');
});

test('export associates use case filters the operational report by associate status', async () => {
  const associates = [
    {
      id: 8,
      name: 'Socio Activo QA',
      status: 'active',
      participationPercentage: 40,
      interestType: 'monthly',
      interestRate: '2.5000',
    },
    {
      id: 9,
      name: 'Socio Inactivo QA',
      status: 'inactive',
      participationPercentage: 10,
      interestType: 'annual',
      interestRate: '12.0000',
    },
  ];
  const queriedAssociateIds = [];
  const useCase = createExportAssociatesExcel({
    associateRepository: {
      async list() {
        return associates;
      },
      async findById(id) {
        return associates.find((associate) => Number(associate.id) === Number(id));
      },
      async listContributionsByAssociate(id) {
        queriedAssociateIds.push(Number(id));
        return [{ id: 90, amount: 1200000, contributionDate: '2026-04-01', status: 'completed' }];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { role: 'admin' }, filters: { status: 'inactive' } });

  assert.equal(result.success, true);
  assert.deepEqual(queriedAssociateIds, [9]);
  assert.equal(new Set(result.data.rows.map((row) => row.associateId)).size, 1);
  assert.equal(result.data.rows[0].associateId, 9);
  assert.equal(result.data.rows[0].associateName, 'Socio Inactivo QA');
});

test('export associates use case filters movements by operational date range', async () => {
  const associate = {
    id: 8,
    name: 'Socio Fecha QA',
    status: 'active',
    participationPercentage: 40,
    interestType: 'monthly',
    interestRate: '2.5000',
  };
  const useCase = createExportAssociatesExcel({
    associateRepository: {
      async list() {
        return [associate];
      },
      async findById() {
        return associate;
      },
      async listContributionsByAssociate() {
        return [
          { id: 20, amount: 2500000, contributionDate: '2026-03-31', status: 'completed' },
          { id: 21, amount: 3000000, contributionDate: '2026-04-15', status: 'completed' },
        ];
      },
      async listProfitDistributionsByAssociate() {
        return [
          { id: 30, loanId: 9, amount: 100000, distributionDate: '2026-04-20', status: 'completed' },
          { id: 31, loanId: 10, amount: 110000, distributionDate: '2026-05-01', status: 'completed' },
        ];
      },
      async findInstallmentsByAssociateId() {
        return [
          { id: 40, installmentNumber: 1, amount: 25000, dueDate: '2026-04-30', status: 'paid', paidAt: '2026-04-30' },
          { id: 41, installmentNumber: 2, amount: 25000, dueDate: '2026-05-15', status: 'pending' },
        ];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { role: 'admin' }, filters: { fromDate: '2026-04-01', toDate: '2026-04-30' } });
  const movementRows = result.data.rows.filter((row) => row.section !== 'Resumen');

  assert.deepEqual(movementRows.map((row) => row.entryId).sort(), [21, 30, 40]);
  assert.equal(result.data.rows.some((row) => row.entryId === 20), false);
  assert.equal(result.data.rows.some((row) => row.entryId === 31), false);
  assert.equal(result.data.rows.some((row) => row.entryId === 41), false);
});

test('export associates use case rejects inverted date ranges before reading associate records', async () => {
  let repositoryCalled = false;
  const useCase = createExportAssociatesExcel({
    associateRepository: {
      async list() {
        repositoryCalled = true;
        return [];
      },
      async findById() {
        repositoryCalled = true;
        return null;
      },
    },
    reportRepository: {},
  });

  await assert.rejects(() => useCase({
    actor: { role: 'admin' },
    filters: { fromDate: '2026-04-30', toDate: '2026-04-01' },
  }), /fromDate must be before or equal to toDate/i);
  assert.equal(repositoryCalled, false);
});

test('export associates use case uses operational fallbacks for unknown movement labels', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'manual_hold',
    participationPercentage: 25,
    interestType: 'monthly',
    interestRate: '2.5000',
  };
  const useCase = createExportAssociatesExcel({
    associateRepository: {
      async list() {
        return [associate];
      },
      async findById() {
        return associate;
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000000, contributionDate: '2026-01-10', status: 'manual_hold', notes: 'Aporte inicial' }];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, loanId: 9, amount: 150000, distributionDate: '2026-02-10', status: 'manual_hold', distributionType: 'manual_adjustment' }];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
      async listLoansByAssociate() {
        return [];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { role: 'admin' } });
  const serializedRows = JSON.stringify(result.data.rows);

  assert.match(serializedRows, /Estado no clasificado/);
  assert.match(serializedRows, /Tipo de distribución no clasificado/);
  assert.doesNotMatch(serializedRows, /manual_hold|manual_adjustment|manual hold|manual adjustment/);
});

test('export associates use case allows permissioned employees to export the administrative associates report', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'active',
    participationPercentage: 25,
    interestType: 'monthly',
    interestRate: '2.5000',
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
      async listContributionsByAssociate() {
        return [];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
      async listLoansByAssociate() {
        return [];
      },
    },
    reportRepository: {},
  });

  const result = await useCase({ actor: { id: 7, role: 'employee' } });

  assert.equal(result.success, true);
  assert.equal(result.data.rows.length, 1);
  assert.equal(result.data.rows[0].associateName, 'Socio Excel QA');
});

test('export credits use case builds approved workbook fields with current snapshots', async () => {
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
  assert.equal(result.data.rows[0].creditStatus, 'Activo');
  assert.equal(result.data.rows[0].totalInterestPaid, 250000);
  assert.equal(result.data.rows[0].totalInterestGenerated, 382500);
  assert.equal(result.data.sheets[0].name, 'Resumen General');
  assert.equal(result.data.sheets[1].name, 'Detalle de Créditos');
  assert.equal(result.data.sheets[2].name, 'Crédito 9');
  assert.ok(result.data.sheets[2].sections.some((section) => section.title === 'TABLA DE AMORTIZACIÓN'));
  assert.ok(result.data.sheets[2].sections.some((section) => section.title === 'HISTORIAL DE PAGOS'));
  const paymentHistorySection = result.data.sheets[2].sections.find((section) => section.title === 'HISTORIAL DE PAGOS');
  assert.equal(paymentHistorySection.rows[0].paymentType, 'Cuota');
  assert.equal(paymentHistorySection.rows[0].paymentMethod, 'Efectivo');
  assert.notEqual(paymentHistorySection.rows[0].paymentMethod, 'cash');
  const detailHeaders = result.data.sheets[1].columns.map((column) => column.header);
  assert.ok(detailHeaders.includes('Interés Pagado'));
  assert.ok(detailHeaders.includes('Interés Generado'));
  assert.equal(detailHeaders.includes('calculationMethod'), false);
  assert.equal(detailHeaders.includes('ratePolicyId'), false);
  assert.deepEqual(
    result.data.sheets[0].rows.map((row) => row.indicator),
    [
      'Fecha de Generación',
      'Total de Clientes',
      'Total de Créditos',
      'Créditos Activos',
      'Créditos Finalizados',
      'Créditos en Mora',
      'Total Prestado (Capital)',
      'Capital Pendiente',
      'Total a Cobrar',
      'Saldo con Intereses',
      'Total Pagado',
      'Capital Pagado',
      'Interés Pagado',
      'Intereses por Mora',
      'Interés Total Generado',
      'Interés Pendiente',
      'TNA Promedio',
      'Ganancia Promedio por Millón',
      'Tasa de Recaudo',
      '% Total Pagado',
      '% Capital Recuperado',
      '% Intereses Cobrados',
    ],
  );
  assert.deepEqual(
    result.data.sheets[0].rows.map((row) => row.section),
    [
      'INFORMACIÓN GENERAL',
      '',
      '',
      '',
      '',
      '',
      'MONTOS TOTALES (SIN INTERESES)',
      '',
      'MONTOS TOTALES (CON INTERESES)',
      '',
      'PAGOS TOTALES',
      '',
      '',
      '',
      'INTERESES PROYECTADOS',
      '',
      'MÉTRICAS FINANCIERAS',
      '',
      '',
      'PORCENTAJES GLOBALES',
      '',
      '',
    ],
  );

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

test('export credits use case includes every credit for the same customer', async () => {
  const loans = [
    {
      id: 2,
      customerId: 1,
      amount: 2000000,
      interestRate: 35,
      termMonths: 2,
      status: 'active',
      recoveryStatus: 'pending',
      startDate: '2026-04-29T00:00:00.000Z',
      Customer: { id: 1, name: 'pepito perez', phone: '3154688440' },
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-05-29T00:00:00.000Z', scheduledPayment: 1050000, principalComponent: 1000000, interestComponent: 50000, remainingBalance: 1000000, status: 'pending' },
        { installmentNumber: 2, dueDate: '2026-06-29T00:00:00.000Z', scheduledPayment: 1050000, principalComponent: 1000000, interestComponent: 50000, remainingBalance: 0, status: 'pending' },
      ],
    },
    {
      id: 3,
      customerId: 1,
      amount: 800000,
      interestRate: 35,
      termMonths: 1,
      status: 'pending',
      recoveryStatus: 'pending',
      startDate: '2026-05-01T00:00:00.000Z',
      Customer: { id: 1, name: 'pepito perez', phone: '3154688440' },
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-06-01T00:00:00.000Z', scheduledPayment: 823333.33, principalComponent: 800000, interestComponent: 23333.33, remainingBalance: 0, status: 'pending' },
      ],
    },
  ];

  const listedBy = [];
  const useCase = createExportCreditsExcel({
    reportRepository: {
      async listCreditLoans() {
        return loans;
      },
      async listOutstandingLoans() {
        throw new Error('credits export must not use outstanding-only query');
      },
    },
    paymentRepository: {
      async listByLoan(loanId) {
        listedBy.push(loanId);
        return [];
      },
    },
    loanViewService: {
      getCanonicalLoanView(currentLoan) {
        return {
          schedule: currentLoan.emiSchedule,
          snapshot: {
            installmentAmount: currentLoan.emiSchedule[0]?.scheduledPayment || 0,
            totalPayable: currentLoan.emiSchedule.reduce((sum, row) => sum + Number(row.scheduledPayment || 0), 0),
            totalInterest: currentLoan.emiSchedule.reduce((sum, row) => sum + Number(row.interestComponent || 0), 0),
            outstandingPrincipal: currentLoan.amount,
            outstandingInterest: currentLoan.emiSchedule.reduce((sum, row) => sum + Number(row.interestComponent || 0), 0),
            outstandingBalance: currentLoan.emiSchedule.reduce((sum, row) => sum + Number(row.scheduledPayment || 0), 0),
            nextInstallment: currentLoan.emiSchedule[0],
          },
        };
      },
    },
  });

  const result = await useCase({ actor: { role: 'admin' }, filters: { customerId: 1 } });

  assert.deepEqual(result.data.rows.map((row) => row.creditId).sort((a, b) => a - b), [2, 3]);
  assert.equal(result.data.sheets[1].rows.length, 2);
  assert.ok(result.data.sheets.some((sheet) => sheet.name === 'Crédito 2'));
  assert.ok(result.data.sheets.some((sheet) => sheet.name === 'Crédito 3'));
  assert.deepEqual(listedBy.sort((a, b) => a - b), [2, 3]);
});

test('export credits use case rejects inverted date ranges before reading loans', async () => {
  let repositoryCalled = false;
  const useCase = createExportCreditsExcel({
    reportRepository: {
      async listCreditLoans() {
        repositoryCalled = true;
        return [];
      },
      async listOutstandingLoans() {
        repositoryCalled = true;
        return [];
      },
    },
    paymentRepository: {
      async listByLoan() {
        throw new Error('payment rows should not be read for an invalid range');
      },
    },
    loanViewService: {},
  });

  await assert.rejects(() => useCase({
    actor: { role: 'admin' },
    filters: { startDate: '2026-02-28', endDate: '2026-02-01' },
  }), /startDate must be before or equal to endDate/i);
  assert.equal(repositoryCalled, false);
});

const roleAwareAuth = (config = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  const roles = Array.isArray(config) ? config : [];
  const permissions = Array.isArray(config?.permissions) ? config.permissions : [];
  if (roles.length > 0 && !roles.includes(role)) {
    res.status(403).json({ success: false, error: { message: 'Access denied', statusCode: 403 } });
    return;
  }
  if (permissions.includes('REPORTS_VIEW_ALL') && !['admin', 'employee'].includes(role)) {
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
          status: undefined,
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
            rows: [{ paymentId: 7, loanId: 4, customerId: 10, customerName: 'Ana', amount: '100.00' }],
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
  const payoutSheet = workbook.getWorksheet('Pagos');
  const headers = payoutSheet.getRow(2).values;
  assert.ok(headers.includes('Pago'));
  assert.ok(headers.includes('Crédito'));
  assert.ok(headers.includes('Cliente'));
  assert.equal(headers.includes('ID Pago'), false);
  assert.equal(headers.includes('ID Crédito'), false);
  assert.equal(headers.includes('ID Cliente'), false);
  const visibleHeaders = headers.filter(Boolean);
  assert.equal(new Set(visibleHeaders).size, visibleHeaders.length);
  assert.ok(headers.includes('Interés Aplicado'));
  assert.equal(headers.includes('paymentId'), false);
  assert.equal(headers.includes('paymentMetadata'), false);
  const amountCell = payoutSheet.getRow(3).getCell(6);
  assert.equal(amountCell.value, 100);
  assert.equal(typeof amountCell.value, 'number');
  assert.match(amountCell.numFmt, /\$/);
});

test('export payouts use case rejects inverted date ranges before reading payments', async () => {
  let repositoryCalled = false;
  const useCase = createExportPayoutsExcel({
    paymentRepository: {
      async listPayoutsReport() {
        repositoryCalled = true;
        return { items: [] };
      },
    },
  });

  await assert.rejects(() => useCase({
    actor: { role: 'admin' },
    filters: { startDate: '2026-02-28', endDate: '2026-02-01' },
  }), /fromDate must be before or equal to toDate/i);
  assert.equal(repositoryCalled, false);
});

test('GET /reports/payouts/export returns pdf file for admin', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportPayoutsPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          customerId: '10',
          loanId: undefined,
          creditId: undefined,
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          status: 'annulled',
          paymentType: 'capital',
        });
        return {
          fileName: 'reporte-pagos.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nREPORTE DE PAGOS\n%%EOF'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/payouts/export?format=pdf&customerId=10&startDate=2026-02-01&endDate=2026-02-28&status=annulled&paymentType=capital`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition') || '', /reporte-pagos\.pdf/);
  const body = Buffer.from(await response.arrayBuffer()).toString('utf8');
  assert.match(body, /REPORTE DE PAGOS/);
});

test('export operating expenses report builds operational Excel and PDF artifacts', async () => {
  const { createExportOperatingExpensesReport } = require('@/modules/reports/application/useCases');
  const useCase = createExportOperatingExpensesReport({
    reportRepository: {
      async listOperatingExpensesForReport(filters) {
        assert.deepEqual(filters, {
          fromDate: new Date('2026-05-01T00:00:00.000Z'),
          toDate: new Date('2026-05-31T23:59:59.999Z'),
          status: 'annulled',
        });
        return [{
          id: 12,
          amount: 950000,
          expenseDate: '2026-05-12T00:00:00.000Z',
          category: 'Servicios',
          description: 'Internet oficina',
          paymentMethod: 'Transferencia',
          reference: 'TRX-12',
          status: 'annulled',
          annulmentReason: 'Registro duplicado',
          createdBy: { name: 'Operador QA' },
          annulledBy: { name: 'Admin QA' },
          createdAt: '2026-05-12T10:00:00.000Z',
          annulledAt: '2026-05-13T10:00:00.000Z',
        }];
      },
    },
  });

  const excel = await useCase({
    actor: { role: 'admin' },
    format: 'xlsx',
    filters: { fromDate: '2026-05-01', toDate: '2026-05-31', status: 'annulled' },
  });

  assert.equal(excel.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(excel.sheets[0].name, 'Gastos Operativos');
  assert.deepEqual(excel.sheets[0].rows[0], {
    expenseId: 12,
    expenseDate: '2026-05-12',
    category: 'Servicios',
    description: 'Internet oficina',
    amount: 950000,
    paymentMethod: 'Transferencia',
    status: 'Anulado',
    reference: 'TRX-12',
    createdBy: 'Operador QA',
    annulledBy: 'Admin QA',
    annulledAt: '2026-05-13',
    annulmentReason: 'Registro duplicado',
  });
  assert.equal(excel.sheets[0].rows.some((row) => row.status === 'annulled'), false);

  const pdf = await useCase({
    actor: { role: 'admin' },
    format: 'pdf',
    filters: { fromDate: '2026-05-01', toDate: '2026-05-31', status: 'annulled' },
  });

  assert.equal(pdf.contentType, 'application/pdf');
  assert.match(pdf.buffer.toString('utf8'), /Gastos operativos/);
  assert.match(pdf.buffer.toString('utf8'), /Total reportado: \$950000.00/);
  assert.match(pdf.buffer.toString('utf8'), /Anulado/);
});

test('export operating expenses report rejects inverted date ranges before querying repository', async () => {
  const { createExportOperatingExpensesReport } = require('@/modules/reports/application/useCases');

  let repositoryCalled = false;
  const useCase = createExportOperatingExpensesReport({
    reportRepository: {
      async listOperatingExpensesForReport() {
        repositoryCalled = true;
        return [];
      },
    },
  });

  await assert.rejects(() => useCase({
    actor: { role: 'admin' },
    format: 'xlsx',
    filters: { fromDate: '2026-05-31', toDate: '2026-05-01' },
  }), /fromDate must be before or equal to toDate/i);
  assert.equal(repositoryCalled, false);
});

test('GET /reports/operating-expenses/export returns filtered xlsx and pdf files for admin', async () => {
  const calls = [];
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportOperatingExpensesReport(input) {
        calls.push(input);
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          fromDate: '2026-05-01',
          toDate: '2026-05-31',
          status: 'completed',
        });

        if (input.format === 'pdf') {
          return {
            contentType: 'application/pdf',
            fileName: 'gastos-operativos-2026-05-24.pdf',
            buffer: Buffer.from('%PDF-1.4 gastos operativos', 'utf8'),
          };
        }

        return {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: 'gastos-operativos-2026-05-24.xlsx',
          sheets: [{
            name: 'Gastos Operativos',
            title: 'REPORTE DE GASTOS OPERATIVOS',
            columns: [
              { header: 'Gasto', key: 'expenseId', width: 12 },
              { header: 'Fecha', key: 'expenseDate', width: 18 },
              { header: 'Categoría', key: 'category', width: 24 },
              { header: 'Descripción', key: 'description', width: 32 },
              { header: 'Monto', key: 'amount', width: 18, numFmt: '"$"#,##0.00' },
              { header: 'Estado', key: 'status', width: 16 },
              { header: 'Registrado por', key: 'createdBy', width: 24 },
            ],
            rows: [{
              expenseId: 1,
              expenseDate: '2026-05-10',
              category: 'Arriendo',
              description: 'Arriendo oficina',
              amount: 850000,
              status: 'Completado',
              createdBy: 'Admin QA',
            }],
          }],
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const xlsxResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/operating-expenses/export?fromDate=2026-05-01&toDate=2026-05-31&status=completed`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(xlsxResponse.status, 200);
  assert.equal(xlsxResponse.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(xlsxResponse.headers.get('content-disposition') || '', /gastos-operativos-2026-05-24\.xlsx/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await xlsxResponse.arrayBuffer()));
  const sheet = workbook.getWorksheet('Gastos Operativos');
  const headers = sheet.getRow(2).values;
  assert.ok(headers.includes('Gasto'));
  assert.ok(headers.includes('Fecha'));
  assert.ok(headers.includes('Categoría'));
  assert.ok(headers.includes('Monto'));
  assert.equal(headers.includes('expenseId'), false);
  assert.equal(sheet.getRow(3).getCell(5).value, 850000);

  const pdfResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/operating-expenses/export?format=pdf&fromDate=2026-05-01&toDate=2026-05-31&status=completed`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
  assert.match(pdfResponse.headers.get('content-disposition') || '', /gastos-operativos-2026-05-24\.pdf/);
  assert.equal(calls.map((call) => call.format).join(','), 'xlsx,pdf');
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
                loanId: 4,
                customerName: 'QA Cliente',
                amount: '50000.00',
                paymentType: 'installment',
                status: 'completed',
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

  const loanHeaders = workbook.getWorksheet('Préstamos recientes').getRow(2).values;
  assert.ok(loanHeaders.includes('Crédito'));
  assert.equal(loanHeaders.includes('ID Crédito'), false);
  assert.equal(workbook.getWorksheet('Préstamos recientes').getRow(3).getCell(4).value, 'Activo');

  const paymentHeaders = workbook.getWorksheet('Pagos recientes').getRow(2).values;
  assert.ok(paymentHeaders.includes('Pago'));
  assert.ok(paymentHeaders.includes('Crédito'));
  assert.equal(paymentHeaders.includes('ID Pago'), false);
  assert.equal(paymentHeaders.includes('ID Crédito'), false);
  assert.equal(workbook.getWorksheet('Pagos recientes').getRow(3).getCell(5).value, 'Cuota');
  assert.equal(workbook.getWorksheet('Pagos recientes').getRow(3).getCell(6).value, 'Completado');
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
  assert.ok(headers.includes('Tipo de Interés'));
  assert.ok(headers.includes('Deuda con Socio'));
  assert.equal(headers.includes('associateId'), false);
});

test('GET /reports/associates/export returns pdf file for admin', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        return {
          fileName: 'associates-export.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nREPORTE DE SOCIOS INVERSIONISTAS\n%%EOF', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/export?format=pdf`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="associates-export.pdf"');
  assert.match(Buffer.from(await response.arrayBuffer()).toString('utf8'), /REPORTE DE SOCIOS INVERSIONISTAS/);
});

test('GET /reports/associates/export forwards associate filter to pdf export use case', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, { associateId: 8, fromDate: undefined, toDate: undefined, status: undefined });
        return {
          fileName: 'associates-export.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nSOCIO FILTRADO\n%%EOF', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/export?format=pdf&associateId=8`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('GET /reports/associates/export forwards status filter to pdf export use case', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          associateId: undefined,
          fromDate: undefined,
          toDate: undefined,
          status: 'inactive',
        });
        return {
          fileName: 'associates-export.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nSOCIOS INACTIVOS\n%%EOF', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/export?format=pdf&status=inactive`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('GET /reports/associates/export forwards date range filters to pdf export use case', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          associateId: undefined,
          fromDate: '2026-04-01',
          toDate: '2026-04-30',
          status: undefined,
        });
        return {
          fileName: 'associates-export.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nSOCIOS POR FECHA\n%%EOF', 'utf8'),
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/associates/export?format=pdf&fromDate=2026-04-01&toDate=2026-04-30`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('GET /reports/associates/excel allows employee role with report permission', async () => {
  const router = createReportsRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async getRecoveredLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getOutstandingLoans() { return { success: true, data: { loans: [] }, summary: {} }; },
      async getRecoveryReport() { return { success: true, data: { recoveredLoans: [], outstandingLoans: [] }, summary: {} }; },
      async getDashboardSummary() { return { success: true, data: { summary: {} } }; },
      async exportAssociatesExcel(input) {
        assert.equal(input.actor.role, 'employee');
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
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'employee' },
  });

  assert.equal(response.status, 200);
});

test('GET /reports/associates/excel rejects socio role', async () => {
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
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'socio' },
  });

  assert.equal(response.status, 403);
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

const buildCreditFixtures = () => {
  const loans = [
    {
      id: 11,
      customerId: 30,
      amount: 1000000,
      interestRate: 30,
      termMonths: 1,
      status: 'active',
      recoveryStatus: 'pending',
      startDate: '2026-04-01T00:00:00.000Z',
      calculationMethod: 'FRENCH',
      policySnapshot: {},
      Customer: { name: 'Cliente Activo', documentNumber: 'A-1', phone: '1', email: 'a@t.local', status: 'active' },
      Associate: null,
      emiSchedule: [],
    },
    {
      id: 12,
      customerId: 31,
      amount: 2000000,
      interestRate: 30,
      termMonths: 1,
      status: 'closed',
      recoveryStatus: 'recovered',
      startDate: '2026-03-01T00:00:00.000Z',
      calculationMethod: 'FRENCH',
      policySnapshot: {},
      Customer: { name: 'Cliente Cerrado', documentNumber: 'A-2', phone: '2', email: 'b@t.local', status: 'active' },
      Associate: null,
      emiSchedule: [],
    },
  ];
  const reportRepository = {
    async listOutstandingLoans() { return loans; },
  };
  const paymentRepository = { async listByLoan() { return []; } };
  const loanViewService = {
    getCanonicalLoanView(loan) {
      return {
        schedule: [],
        snapshot: {
          installmentAmount: loan.amount,
          totalPayable: loan.amount,
          totalInterest: 0,
          outstandingPrincipal: loan.status === 'active' ? loan.amount : 0,
          outstandingInterest: 0,
          outstandingBalance: loan.status === 'active' ? loan.amount : 0,
          nextInstallment: null,
        },
      };
    },
  };
  return { reportRepository, paymentRepository, loanViewService };
};

test('credits export filters by status (active only excludes closed loans)', async () => {
  const { createExportCreditsExcel: createUseCase } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
  const fixtures = buildCreditFixtures();
  const useCase = createUseCase(fixtures);
  const result = await useCase({ actor: { role: 'admin' }, filters: { status: 'active' } });
  assert.equal(result.success, true);
  assert.equal(result.data.rows.length, 1);
  assert.equal(result.data.rows[0].creditId, 11);
});

test('credits PDF export returns a valid PDF buffer with summary headline', async () => {
  const { createExportCreditsPdf } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
  const fixtures = buildCreditFixtures();
  const useCase = createExportCreditsPdf(fixtures);
  const result = await useCase({ actor: { role: 'admin' }, filters: {} });
  assert.ok(result.fileName.endsWith('.pdf'));
  assert.equal(result.contentType, 'application/pdf');
  const head = result.buffer.subarray(0, 4).toString('utf8');
  assert.equal(head, '%PDF');
});
