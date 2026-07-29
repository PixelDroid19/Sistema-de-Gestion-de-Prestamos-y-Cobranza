const { test, afterEach } = require('node:test');
const { extractPdfText } = require('./helpers/pdfText');
const assert = require('node:assert/strict');
const express = require('express');
const ExcelJS = require('exceljs');

const { createReportsRouter } = require('@/modules/reports/presentation/router');
const { createAssociatesRouter } = require('@/modules/associates/presentation/router');
const { createExportCreditsExcel } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
const { createExportPayoutsExcel } = require('@/modules/reports/application/useCases/createExportPayoutsExcel');
const { createExportAssociatesExcel, createExportAssociatesPdf, createGetAssociateMovementsReport } = require('@/modules/associates/application/reportingUseCases');
const { formatOperationalStatus, formatPaymentMethod, formatPaymentType } = require('@/modules/reports/application/reportLabels');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');
const { MONEY_FORMAT } = require('@/modules/reports/application/excelExportFormats');
const { closeServer, listen } = require('./helpers/http');

let activeServer;
const associateValidation = {
  create(_req, _res, next) { next(); },
  update(_req, _res, next) { next(); },
};

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('shared workbook builder writes display-ready values for formatted report cells', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbookBuffer([{
    name: 'Formato QA',
    columns: [
      { header: 'Fecha', key: 'date', numFmt: 'dd/mm/yyyy' },
      { header: 'Fecha Registro', key: 'dateTime', numFmt: 'dd/mm/yyyy h:mm AM/PM' },
      { header: 'Monto', key: 'amount', numFmt: MONEY_FORMAT },
      { header: 'Porcentaje', key: 'percent', numFmt: '0.00%' },
      { header: 'TNA', key: 'tna', numFmt: '0.00"%"' },
      { header: 'Años', key: 'years', numFmt: '0.00' },
    ],
    rows: [{
      date: '2026-06-12',
      dateTime: '2026-06-12T22:13:00.000Z',
      amount: 8500000,
      percent: 0.65,
      tna: 60,
      years: 1.5,
    }],
  }]));

  const row = workbook.getWorksheet('Formato QA').getRow(2);
  assert.equal(row.getCell(1).value, '12/06/2026');
  assert.equal(row.getCell(2).value, '12/06/2026 5:13 p. m.');
  assert.equal(row.getCell(3).value, 'COP 8.500.000,00');
  assert.equal(row.getCell(4).value, '65,00%');
  assert.equal(row.getCell(5).value, '60,00%');
  assert.equal(row.getCell(6).value, '1,50');
});

test('shared workbook builder preserves operational day for date-only UTC-midnight timestamps', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbookBuffer([{
    name: 'Formato Fecha Operativa',
    columns: [
      { header: 'Fecha', key: 'date', numFmt: 'dd/mm/yyyy' },
      { header: 'Fecha Registro', key: 'dateTime', numFmt: 'dd/mm/yyyy h:mm AM/PM' },
    ],
    rows: [{
      date: '2026-06-01T00:00:00.000Z',
      dateTime: '2026-06-01T00:00:00.000Z',
    }],
  }]));

  const row = workbook.getWorksheet('Formato Fecha Operativa').getRow(2);
  assert.equal(row.getCell(1).value, '01/06/2026');
  assert.equal(row.getCell(2).value, '31/05/2026 7:00 p. m.');
});

test('report labels preserve recorded values when they are not catalog values', () => {
  assert.equal(formatOperationalStatus('manual_hold'), 'manual_hold');
  assert.equal(formatPaymentType('adjustment_fee'), 'adjustment_fee');
  assert.equal(formatPaymentMethod('wallet_mobile'), 'wallet_mobile');
  assert.equal(formatOperationalStatus(null), 'Sin estado');
  assert.equal(formatPaymentType(undefined), 'Sin tipo');
  assert.equal(formatPaymentMethod(''), 'Sin método');
});

test('export associates use case builds approved operational sheet structure', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'active',
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
        return [
          { id: 2, loanId: 9, amount: 150000, distributionDate: '2026-02-10', status: 'completed', distributionType: 'manual' },
          { id: 5, loanId: null, amount: 50000, distributionDate: '2026-02-20', status: 'completed', basis: { type: 'reinvestment' } },
        ];
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
    'Movimientos por Estado',
    'Movimientos por Tipo',
    'Detalle de Socios',
    'Control financiero',
    'Resumen de movimientos',
  ]);
  assert.equal(result.data.sheets[0].columns.some((column) => column.header === 'Unidad'), false);
  assert.equal(result.data.sheets[4].columns.some((column) => column.header === 'Unidad'), false);
  assert.deepEqual(result.data.sheets[3].columns.slice(0, 7).map((column) => column.header), [
    'ID Socio',
    'Socio',
    'Tipo de tasa',
    'Tasa Pactada %',
    'Deuda con Socio',
    'Interés Pagado',
    'Próximo Pago',
  ]);
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Rentabilidad del Aporte'));
  assert.ok(result.data.sheets[3].columns.some((column) => column.header === 'Tasa Histórica del Aporte %'));
  assert.ok(result.data.rows.some((row) => row.section === 'Interés pagado'));
  assert.ok(result.data.rows.some((row) => row.section === 'Interés pendiente'));
  assert.ok(result.data.rows.some((row) => row.section === 'Interés pendiente' && row.status === 'Vencido'));
  assert.ok(result.data.rows.some((row) => row.section === 'Aporte'));
  assert.ok(result.data.rows.some((row) => row.section === 'Aporte' && row.contributionInterestType === 'Tasa mensual' && row.contributionInterestRate === '2.5000'));
  assert.ok(result.data.rows.some((row) => row.section === 'Pago manual de rentabilidad'));
  const manualProfitabilityRow = result.data.rows.find((row) => (
    row.section === 'Pago manual de rentabilidad' && Number(row.entryId) === 2
  ));
  assert.ok(manualProfitabilityRow, 'manual profitability distribution should export in its own operational section');
  assert.equal(manualProfitabilityRow.distributionType, 'Pago manual de rentabilidad');
  const reinvestmentRow = result.data.rows.find((row) => (
    row.section === 'Reinversión' && Number(row.entryId) === 5
  ));
  assert.ok(reinvestmentRow, 'reinvestments should export in their own operational section');
  assert.equal(reinvestmentRow.distributionType, 'Reinversión');
  assert.equal(
    result.data.rows.some((row) => Object.values(row).some((value) => /proportional|Participaci[oó]n|Monto Asignado|Total Proporcional/i.test(String(value ?? '')))),
    false,
  );
  assert.equal(result.data.rows[0].date, '');
  assert.equal(result.data.rows.some((row) => /contribution|distribution|Distributed|Interest installments|N\/A/i.test(`${row.section} ${row.date} ${row.notes}`)), false);
});

test('associate movements report exposes the same filtered movement dataset used by exports', async () => {
  const associate = { id: 4, name: 'Socio Movimientos', status: 'active', interestType: 'monthly', interestRate: '2.5' };
  const report = createGetAssociateMovementsReport({
    associateRepository: {
      async list() { return [associate]; },
      async findById() { return associate; },
      async listContributionsByAssociate() {
        return [
          { id: 1, amount: 1000000, contributionDate: '2026-07-01', status: 'completed' },
          { id: 6, amount: 50000, contributionDate: '2026-07-05', status: 'completed' },
        ];
      },
      async listProfitDistributionsByAssociate() {
        return [
          { id: 2, amount: 50000, distributionDate: '2026-07-05', basis: { type: 'reinvestment' } },
          { id: 3, amount: 25000, distributionDate: '2026-06-20', basis: { type: 'capital-return' } },
        ];
      },
      async findInstallmentsByAssociateId() {
        return [
          { id: 4, installmentNumber: 1, amount: 25000, dueDate: '2026-07-10', paidAt: '2026-07-10', status: 'paid' },
          { id: 5, installmentNumber: 2, amount: 25000, dueDate: '2026-08-10', status: 'pending' },
        ];
      },
    },
  });

  const result = await report({
    actor: { role: 'admin' },
    filters: { status: 'active', fromDate: '2026-07-01', toDate: '2026-07-31' },
  });

  assert.deepEqual(result.rows.map((row) => row.movementType), [
    'contribution',
    'reinvestment',
    'scheduled_profitability_paid',
  ]);
  assert.equal(result.summary.totalMovements, 3);
  assert.equal(result.summary.contributions, 1000000);
  assert.equal(result.summary.reinvestments, 50000);
  assert.equal(result.summary.capitalReturns, 0);
  assert.equal(result.summary.profitabilityPaid, 25000);
});

test('associate movements report preserves an external contribution that matches a linked reinvestment', async () => {
  const associate = { id: 4, name: 'Socio Coincidencia', status: 'active', interestType: 'monthly', interestRate: '2.5' };
  const report = createGetAssociateMovementsReport({
    associateRepository: {
      async list() { return [associate]; },
      async findById() { return associate; },
      async listContributionsByAssociate() {
        return [
          { id: 6, amount: 50000, contributionDate: '2026-07-05', status: 'completed' },
          { id: 7, amount: 50000, contributionDate: '2026-07-05', status: 'completed' },
        ];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 50000, distributionDate: '2026-07-05', basis: { type: 'reinvestment', contributionId: 7 } }];
      },
      async findInstallmentsByAssociateId() { return []; },
    },
  });

  const result = await report({ actor: { role: 'admin' } });

  assert.deepEqual(result.rows.filter((row) => row.movementType === 'contribution').map((row) => row.id), [6]);
  assert.equal(result.summary.contributions, 50000);
  assert.equal(result.summary.reinvestments, 50000);
});

test('export associates PDF summarizes associate payments, pending interest, and schedule', async () => {
  const associate = {
    id: 4,
    name: 'Socio PDF QA',
    status: 'active',
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
        return [
          { id: 5, amount: 10000, distributionDate: '2026-02-20', status: 'completed', basis: { type: 'manual-interest' } },
          { id: 6, amount: 12000, distributionDate: '2026-02-21', status: 'completed', basis: { type: 'reinvestment' } },
          { id: 7, amount: 15000, distributionDate: '2026-02-22', status: 'completed', basis: { type: 'capital-return' } },
        ];
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
  const pdfText = extractPdfText(result.buffer);

  assert.equal(result.fileName, 'reporte-socios.pdf');
  assert.equal(result.contentType, 'application/pdf');
  assert.match(pdfText, /Socios inversionistas/);
  assert.match(pdfText, /Intereses pagados/);
  assert.match(pdfText, /Intereses pendientes/);
  assert.match(pdfText, /COP 25.000,00/);
  assert.match(pdfText, /Socio PDF QA/);
  assert.match(pdfText, /Pagos manuales de rentabilidad/);
  assert.match(pdfText, /PAGOS MANUALES DE RENTABILIDAD/);
  assert.match(pdfText, /Reinversiones/);
  assert.match(pdfText, /Devoluciones de capital/);
  assert.match(pdfText, /10\/01\/2026/);
  assert.doesNotMatch(pdfText, /GMT|Standard Time|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);
  assert.equal(
    (result.buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length,
    1,
    'the footer must not create extra blank pages',
  );
});

test('export associates PDF omits optional movement sections when no records exist', async () => {
  const associate = {
    id: 9,
    name: 'Socio Sin Movimientos',
    status: 'active',
    interestType: 'monthly',
    interestRate: '2.0000',
  };
  const useCase = createExportAssociatesPdf({
    associateRepository: {
      async list() { return [associate]; },
      async findById() { return associate; },
      async listContributionsByAssociate() { return []; },
      async listProfitDistributionsByAssociate() { return []; },
      async findInstallmentsByAssociateId() { return []; },
    },
  });

  const result = await useCase({ actor: { role: 'admin' } });
  const pdfText = extractPdfText(result.buffer);

  assert.doesNotMatch(pdfText, /Pagos manuales de rentabilidad/);
  assert.doesNotMatch(pdfText, /Reinversiones/);
  assert.doesNotMatch(pdfText, /Devoluciones de capital/);
});

test('export associates use case filters the operational report by associate id', async () => {
  const associate = {
    id: 8,
    name: 'Socio Filtrado QA',
    status: 'active',
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
      interestType: 'monthly',
      interestRate: '2.5000',
    },
    {
      id: 9,
      name: 'Socio Inactivo QA',
      status: 'inactive',
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

test('export associates use case filters the operational report by visible search terms', async () => {
  const associates = [
    {
      id: 11,
      name: 'Socio Exportable QA',
      email: 'exportable@test.local',
      phone: '3001112233',
      status: 'active',
      interestType: 'monthly',
      interestRate: '2.5000',
    },
    {
      id: 12,
      name: 'Socio Oculto QA',
      email: 'oculto@test.local',
      phone: '3009998877',
      status: 'active',
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
        return [{ id: 91, amount: 1200000, contributionDate: '2026-04-01', status: 'completed' }];
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

  const result = await useCase({ actor: { role: 'admin' }, filters: { search: 'exportable' } });

  assert.equal(result.success, true);
  assert.deepEqual(queriedAssociateIds, [11]);
  assert.equal(new Set(result.data.rows.map((row) => row.associateId)).size, 1);
  assert.equal(result.data.rows[0].associateId, 11);
  assert.equal(result.data.rows[0].associateName, 'Socio Exportable QA');
});

test('export associates use case filters movements by operational date range', async () => {
  const associate = {
    id: 8,
    name: 'Socio Fecha QA',
    status: 'active',
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
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
  assert.equal(repositoryCalled, false);
});

test('export associates use case exports manual movements with the canonical label', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'manual_hold',
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
        return [{ id: 2, loanId: 9, amount: 150000, distributionDate: '2026-02-10', status: 'manual_hold', basis: { type: 'manual' } }];
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

  assert.match(serializedRows, /manual_hold/);
  assert.match(serializedRows, /Pago manual de rentabilidad/);
  assert.doesNotMatch(serializedRows, /Estado no clasificado|Tipo de distribución no clasificado/);
});

test('export associates use case allows permissioned employees to export the administrative associates report', async () => {
  const associate = {
    id: 4,
    name: 'Socio Excel QA',
    status: 'active',
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
  assert.ok(detailHeaders.includes('Interés Proyectado'));
  assert.ok(detailHeaders.includes('Mora Pagada'));
  assert.equal(detailHeaders.includes('Mora Acumulada'), false);
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
      'Interés Total Proyectado',
      'Interés Pendiente',
      'TNA Promedio',
      'Interés y mora promedio por millón',
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
  assert.equal(totalPrestadoRow.getCell(3).value, 'COP 5.000.000,00');

  const tnaRow = findRowByIndicator(summarySheet, 'TNA Promedio');
  assert.ok(tnaRow, 'Summary should include formatted TNA');
  assert.equal(tnaRow.getCell(3).value, '60,00%');

  const generationDateRow = findRowByIndicator(summarySheet, 'Fecha de Generación');
  assert.ok(generationDateRow, 'Summary should include formatted generation date');
  assert.match(String(generationDateRow.getCell(3).value), /^\d{2}\/\d{2}\/\d{4} \d{1,2}:\d{2} [ap]\. m\.$/);

  const percentPaidRow = findRowByIndicator(summarySheet, '% Total Pagado');
  assert.ok(percentPaidRow, 'Summary should include formatted percent paid');
  assert.match(String(percentPaidRow.getCell(3).value), /^\d{1,3},\d{2}%$/);
  assert.doesNotMatch(String(percentPaidRow.getCell(3).value), /^0\./);

  const detailLoanDate = detailSheet.getRow(3).getCell(25);
  assert.equal(detailLoanDate.value, '29/04/2026');

  let creditAmountRow = null;
  let creditRateRow = null;
  creditSheet.eachRow((row) => {
    if (row.getCell(1).value === 'Monto Préstamo') {
      creditAmountRow = row;
    }
    if (row.getCell(1).value === 'Tasa del crédito') {
      creditRateRow = row;
    }
  });
  assert.ok(creditAmountRow, 'Credit-specific sheet should include formatted credit amount');
  assert.equal(creditAmountRow.getCell(2).value, 'COP 5.000.000,00');
  assert.ok(creditRateRow, 'Credit-specific sheet should include the loan rate');
  assert.equal(creditRateRow.getCell(2).value, '60,00%');

  let amortizationHeaderRow = null;
  let paymentHeaderRow = null;
  creditSheet.eachRow((row) => {
    if (row.getCell(1).value === 'Número de Cuota') {
      amortizationHeaderRow = row;
    }
    if (row.getCell(1).value === 'Fecha de Pago') {
      paymentHeaderRow = row;
    }
  });
  assert.ok(amortizationHeaderRow, 'Credit-specific sheet should include amortization rows');
  assert.equal(creditSheet.getRow(amortizationHeaderRow.number + 2).getCell(2).value, 'COP 2.600.000,00');
  assert.equal(creditSheet.getRow(amortizationHeaderRow.number + 2).getCell(3).value, 'COP 250.000,00');
  assert.ok(paymentHeaderRow, 'Credit-specific sheet should include payment history rows');
  assert.equal(creditSheet.getRow(paymentHeaderRow.number + 1).getCell(1).value, '29/05/2026');
  assert.equal(creditSheet.getRow(paymentHeaderRow.number + 1).getCell(2).value, 'COP 2.600.000,00');
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
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
  assert.equal(repositoryCalled, false);
});

const roleAwareAuth = (config = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  const roles = Array.isArray(config) ? config : [];
  const permissions = Array.isArray(config?.permissions) ? config.permissions : [];
  if (roles.length > 0 && !roles.includes(role)) {
    res.status(403).json({ success: false, error: { message: 'No tienes acceso a esta acción.', statusCode: 403 } });
    return;
  }
  if (permissions.length > 0 && !['admin', 'employee'].includes(role)) {
    res.status(403).json({ success: false, error: { message: 'No tienes acceso a esta acción.', statusCode: 403 } });
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
                  { header: 'Interés Proyectado', key: 'totalInterestGenerated' },
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
  assert.ok(detailHeaders.includes('Interés Proyectado'));
  assert.equal(detailHeaders.includes('loanId'), false);
  assert.equal(detailHeaders.includes('calculationMethod'), false);
});

test('GET /reports/payouts/export returns xlsx file for admin', async () => {
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
          employeeId: undefined,
        });
        return {
          success: true,
          data: {
            rows: [{ paymentId: 7, loanId: 4, customerId: 10, customerName: 'Ana', amount: '100.00' }],
            sheets: [{
              name: 'Pagos',
              title: 'REPORTE DE PAGOS',
              columns: [
                { header: 'Pago', key: 'paymentId' },
                { header: 'Crédito', key: 'loanId' },
                { header: 'Referencia cliente', key: 'customerId' },
                { header: 'Cliente', key: 'customerName' },
                { header: 'Fecha de Pago', key: 'paymentDate', numFmt: 'dd/mm/yyyy' },
                { header: 'Monto', key: 'amount', numFmt: MONEY_FORMAT },
                { header: 'Interés Aplicado', key: 'interestApplied', numFmt: MONEY_FORMAT },
              ],
              rows: [{
                paymentId: 7,
                loanId: 4,
                customerId: 10,
                customerName: 'Ana',
                paymentDate: new Date('2026-02-14T00:00:00.000Z'),
                amount: '100.00',
                interestApplied: '25.00',
              }],
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/payouts/export?format=xlsx&customerId=10&startDate=2026-02-01&endDate=2026-02-28`, {
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
  assert.equal(amountCell.value, 'COP 100,00');
  assert.match(amountCell.numFmt, /COP/);
  assert.equal(payoutSheet.getRow(3).getCell(5).value, '14/02/2026');
});

test('export payouts use case builds workbook sheets with operational headers and typed dates', async () => {
  let repositoryQuery;
  const useCase = createExportPayoutsExcel({
    paymentRepository: {
      async listPayoutsReport(query) {
        repositoryQuery = query;
        return {
          items: [{
            id: 7,
            loanId: 4,
            paymentDate: '2026-02-14T00:00:00.000Z',
            createdAt: '2026-02-14T15:30:00.000Z',
            amount: 100,
            principalApplied: 75,
            interestApplied: 25,
            penaltyApplied: 0,
            remainingBalanceAfterPayment: 900,
            paymentType: 'installment',
            paymentMethod: 'cash',
            status: 'completed',
            createdBy: { id: 7, name: 'Operador QA', email: 'operador@test.local' },
            paymentMetadata: { reference: 'REC-7', voucherNumber: 'VCH-7' },
            Loan: {
              customerId: 10,
              Customer: { id: 10, name: 'Ana' },
            },
          }],
        };
      },
    },
  });

  const result = await useCase({
    actor: { role: 'admin' },
    filters: { customerId: '10', employeeId: '7', startDate: '2026-02-01', endDate: '2026-02-28' },
  });

  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.data.sheets));
  assert.equal(result.data.sheets[0].name, 'Pagos');
  assert.deepEqual(
    result.data.sheets[0].columns.map((column) => column.header).slice(0, 6),
    ['Pago', 'Crédito', 'Referencia cliente', 'Cliente', 'Fecha de Pago', 'Monto'],
  );
  assert.ok(result.data.sheets[0].columns.map((column) => column.header).includes('Registrado por'));
  assert.equal(result.data.sheets[0].rows[0].paymentType, 'Cuota');
  assert.equal(result.data.sheets[0].rows[0].paymentMethod, 'Efectivo');
  assert.equal(result.data.sheets[0].rows[0].createdBy, 'Operador QA');
  assert.ok(result.data.sheets[0].rows[0].paymentDate instanceof Date);
  assert.ok(result.data.sheets[0].rows[0].createdAt instanceof Date);
  assert.equal(repositoryQuery.createdByUserId, 7);
});

test('export payouts labels rows without a retained creator as historical records', async () => {
  const useCase = createExportPayoutsExcel({
    paymentRepository: {
      async listPayoutsReport() {
        return {
          items: [{
            id: 8,
            loanId: 4,
            paymentDate: '2026-02-14T00:00:00.000Z',
            createdAt: '2026-02-14T15:30:00.000Z',
            amount: 100,
            principalApplied: 75,
            interestApplied: 25,
            paymentType: 'installment',
            paymentMethod: 'cash',
            status: 'completed',
            Loan: { customerId: 10, Customer: { id: 10, name: 'Ana' } },
          }],
        };
      },
    },
  });

  const result = await useCase({ actor: { role: 'admin' } });

  assert.equal(result.data.sheets[0].rows[0].createdBy, 'Registro histórico');
});

test('export payouts names missing historical relations instead of exposing N/A', async () => {
  const useCase = createExportPayoutsExcel({
    paymentRepository: {
      async listPayoutsReport() {
        return {
          items: [{
            id: 9,
            loanId: 4,
            amount: 100,
            principalApplied: 75,
            interestApplied: 25,
            status: 'completed',
            Loan: { customerId: 10 },
          }],
        };
      },
    },
  });

  const result = await useCase({ actor: { role: 'admin' } });
  const row = result.data.sheets[0].rows[0];

  assert.equal(row.customerName, 'Cliente no disponible');
  assert.equal(row.customerEmail, 'Sin correo registrado');
  assert.equal(row.paymentDate, 'Sin fecha');
  assert.equal(row.paymentType, 'Sin tipo');
  assert.equal(row.paymentMethod, 'Sin método');
  assert.equal(row.createdAt, 'Sin fecha');
  assert.equal(Object.values(row).includes('N/A'), false);
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
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
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
          employeeId: undefined,
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
          employeeId: 7,
        });
        return [{
          id: 12,
          amount: 950000,
          expenseDate: '2026-05-12T00:00:00.000Z',
          category: 'Servicios',
          description: 'Internet oficina',
          paymentMethod: 'bank_transfer',
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
    filters: { fromDate: '2026-05-01', toDate: '2026-05-31', status: 'annulled', employeeId: '7' },
  });

  assert.equal(excel.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(excel.sheets[0].name, 'Gastos Operativos');
  assert.equal(excel.sheets[0].rows[0].expenseId, 12);
  assert.ok(excel.sheets[0].rows[0].expenseDate instanceof Date);
  assert.equal(excel.sheets[0].rows[0].amount, 950000);
  assert.equal(excel.sheets[0].rows[0].paymentMethod, 'Transferencia');
  assert.equal(excel.sheets[0].rows[0].status, 'Anulado');
  assert.ok(excel.sheets[0].rows[0].annulledAt instanceof Date);
  assert.equal(excel.sheets[0].rows.some((row) => row.status === 'annulled'), false);

  const pdf = await useCase({
    actor: { role: 'admin' },
    format: 'pdf',
    filters: { fromDate: '2026-05-01', toDate: '2026-05-31', status: 'annulled', employeeId: '7' },
  });

  assert.equal(pdf.contentType, 'application/pdf');
  const expensePdfText = extractPdfText(pdf.buffer);
  assert.match(expensePdfText, /Gastos del negocio/);
  assert.match(expensePdfText, /COP 950.000,00/);
  assert.match(expensePdfText, /Anulado/);
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
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
  assert.equal(repositoryCalled, false);
});

test('export operating expenses report rejects invalid status and format with operational messages', async () => {
  const { createExportOperatingExpensesReport } = require('@/modules/reports/application/useCases');

  const useCase = createExportOperatingExpensesReport({
    reportRepository: {
      async listOperatingExpensesForReport() {
        throw new Error('repository should not be called for invalid export filters');
      },
    },
  });

  await assert.rejects(() => useCase({
    actor: { role: 'admin' },
    format: 'csv',
    filters: {},
  }), (error) => {
    assert.equal(error.message, 'El formato del reporte debe ser Excel o PDF.');
    return true;
  });

  await assert.rejects(() => useCase({
    actor: { role: 'admin' },
    format: 'xlsx',
    filters: { status: 'pending' },
  }), (error) => {
    assert.equal(error.message, 'El estado del gasto operativo debe ser completado o anulado.');
    return true;
  });
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
          employeeId: '7',
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
              { header: 'Fecha', key: 'expenseDate', width: 18, numFmt: 'dd/mm/yyyy' },
              { header: 'Categoría', key: 'category', width: 24 },
              { header: 'Descripción', key: 'description', width: 32 },
              { header: 'Monto', key: 'amount', width: 18, numFmt: MONEY_FORMAT },
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

  const xlsxResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/operating-expenses/export?fromDate=2026-05-01&toDate=2026-05-31&status=completed&employeeId=7`, {
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
  assert.equal(sheet.getRow(3).getCell(2).value, '10/05/2026');
  assert.equal(sheet.getRow(3).getCell(5).value, 'COP 850.000,00');

  const pdfResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/operating-expenses/export?format=pdf&fromDate=2026-05-01&toDate=2026-05-31&status=completed&employeeId=7`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
  assert.match(pdfResponse.headers.get('content-disposition') || '', /gastos-operativos-2026-05-24\.pdf/);
  assert.equal(calls.map((call) => call.format).join(','), 'xlsx,pdf');
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

test('GET /associates/export returns xlsx file for admin', async () => {
  const mockRows = [
    { associateId: 1, associateName: 'Socio 1', section: 'summary', amount: '10000', date: '', status: 'active' },
    { associateId: 1, associateName: 'Socio 1', section: 'contribution', entryId: 1, amount: '5000', date: '2024-01-15', status: 'completed' },
  ];

  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesExcel(input) {
        assert.equal(input.actor.role, 'admin');
        return {
          success: true,
          data: {
            rows: mockRows,
            sheets: [{
              name: 'Detalle de Socios',
              title: 'DETALLE COMPLETO DE SOCIOS',
              columns: [
                { header: 'ID Socio', key: 'associateId' },
                { header: 'Socio', key: 'associateName' },
                { header: 'Tipo de tasa', key: 'interestType' },
                { header: 'Deuda con Socio', key: 'interestDebt', numFmt: MONEY_FORMAT },
              ],
              rows: [{
                associateId: 1,
                associateName: 'Socio 1',
                interestType: 'Tasa mensual',
                interestDebt: '1000.00',
              }],
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="associates-export.xlsx"');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const headers = workbook.getWorksheet('Detalle de Socios').getRow(2).values;
  assert.deepEqual(headers.slice(1, 5), [
    'ID Socio',
    'Socio',
    'Tipo de tasa',
    'Deuda con Socio',
  ]);
  assert.equal(headers.includes('associateId'), false);
  assert.equal(workbook.getWorksheet('Detalle de Socios').getRow(3).getCell(4).value, 'COP 1.000,00');
});

test('GET /associates/export returns pdf file for admin', async () => {
  const router = createAssociatesRouter({
    associateValidation,
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export?format=pdf`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="associates-export.pdf"');
  assert.match(Buffer.from(await response.arrayBuffer()).toString('utf8'), /REPORTE DE SOCIOS INVERSIONISTAS/);
});

test('GET /associates/export forwards associate filter to pdf export use case', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, { associateId: 8, search: undefined, fromDate: undefined, toDate: undefined, status: undefined });
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export?format=pdf&associateId=8`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('GET /associates/export forwards status filter to pdf export use case', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          associateId: undefined,
          search: undefined,
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export?format=pdf&status=inactive`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('GET /associates/export forwards date range filters to pdf export use case', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesPdf(input) {
        assert.equal(input.actor.role, 'admin');
        assert.deepEqual(input.filters, {
          associateId: undefined,
          search: undefined,
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export?format=pdf&fromDate=2026-04-01&toDate=2026-04-30`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('GET /associates/export allows employee role with associates permission', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async exportAssociatesExcel(input) {
        assert.equal(input.actor.role, 'employee');
        return {
          success: true,
          data: {
            rows: [],
            sheets: [{
              name: 'Detalle de Socios',
              title: 'DETALLE COMPLETO DE SOCIOS',
              columns: [{ header: 'ID Socio', key: 'associateId' }],
              rows: [],
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'employee' },
  });

  assert.equal(response.status, 200);
});

test('GET /associates/export rejects socio role', async () => {
  const router = createAssociatesRouter({
    associateValidation,
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export`, {
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'socio' },
  });

  assert.equal(response.status, 403);
});

test('GET /associates/export rejects customer role', async () => {
  const router = createAssociatesRouter({
    associateValidation,
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

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/export`, {
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

test('credits Excel export counts delinquent loans consistently when status and recoveryStatus differ', async () => {
  const { createExportCreditsExcel } = require('@/modules/reports/application/useCases/createExportCreditsExcel');

  const loans = [
    {
      id: 21,
      customerId: 41,
      amount: 1500000,
      interestRate: 30,
      termMonths: 1,
      status: 'defaulted',
      recoveryStatus: 'pending',
      startDate: '2026-04-01T00:00:00.000Z',
      calculationMethod: 'FRENCH',
      policySnapshot: {},
      Customer: { name: 'Cliente Mora Estado', documentNumber: 'D-1', phone: '1', email: 'd1@t.local', status: 'active' },
      Associate: null,
      emiSchedule: [],
    },
    {
      id: 22,
      customerId: 42,
      amount: 1750000,
      interestRate: 30,
      termMonths: 1,
      status: 'closed',
      recoveryStatus: 'overdue',
      startDate: '2026-03-01T00:00:00.000Z',
      calculationMethod: 'FRENCH',
      policySnapshot: {},
      Customer: { name: 'Cliente Mora Recovery', documentNumber: 'D-2', phone: '2', email: 'd2@t.local', status: 'active' },
      Associate: null,
      emiSchedule: [],
    },
  ];

  const fixtures = {
    reportRepository: {
      async listOutstandingLoans() { return loans; },
    },
    paymentRepository: {
      async listByLoan() { return []; },
    },
    loanViewService: {
      getCanonicalLoanView(loan) {
        return {
          schedule: [],
          snapshot: {
            installmentAmount: loan.amount,
            totalPayable: loan.amount,
            totalInterest: 0,
            outstandingPrincipal: loan.amount,
            outstandingInterest: 0,
            outstandingBalance: loan.amount,
            nextInstallment: null,
          },
        };
      },
    },
  };

  const excelResult = await createExportCreditsExcel(fixtures)({ actor: { role: 'admin' }, filters: {} });
  const delinquentRow = excelResult.data.sheets[0].rows.find((row) => row.indicator === 'Créditos en Mora');
  assert.ok(delinquentRow, 'Excel summary should include delinquent credits row');
  assert.equal(delinquentRow.value, 2);
});
