const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const {
  createGetAssociateFinancialSummary,
  createExportAssociateFinancialSummary,
  createGetAssociateMovementsReport,
} = require('@/modules/associates/application/reportingUseCases');

test('createGetAssociateMovementsReport names scheduled interest references as installments', async () => {
  const getReport = createGetAssociateMovementsReport({
    associateRepository: {
      async list() { return [{ id: 12, name: 'Socio Reporte', status: 'active', interestType: 'annual' }]; },
      async listContributionsByAssociate() { return []; },
      async listProfitDistributionsByAssociate() { return []; },
      async findInstallmentsByAssociateId() {
        return [{ id: 31, installmentNumber: 2, amount: 250, dueDate: '2026-04-01', status: 'pending' }];
      },
    },
  });

  const report = await getReport({ actor: { id: 1, role: 'admin' } });

  assert.equal(report.rows[0].reference, 'Cuota #2');
});

test('createGetAssociateFinancialSummary rejects socio records as report users', async () => {
  const getAssociateFinancialSummary = createGetAssociateFinancialSummary({
    associateRepository: {
      async findById(id) {
        throw new Error(`findById should not be called for socio records: ${id}`);
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async listLoansByAssociate() {
        throw new Error('listLoansByAssociate should not be called');
      },
    },
  });

  await assert.rejects(() => getAssociateFinancialSummary({
    actor: { id: 9, role: 'socio', associateId: 12 },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden acceder al resumen financiero de socios.');
    return true;
  });
});

test('createGetAssociateFinancialSummary rejects socio records before associate lookup', async () => {
  const getAssociateFinancialSummary = createGetAssociateFinancialSummary({
    associateRepository: {
      async findById(id) {
        throw new Error(`findById should not be called for socio records: ${id}`);
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async listLoansByAssociate() {
        throw new Error('listLoansByAssociate should not be called');
      },
    },
  });

  await assert.rejects(() => getAssociateFinancialSummary({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 99,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden acceder al resumen financiero de socios.');
    return true;
  });
});

test('createGetAssociateFinancialSummary rejects missing associate access with an operator message', async () => {
  const getAssociateFinancialSummary = createGetAssociateFinancialSummary({
    associateRepository: {
      async findById(id) {
        assert.equal(id, 12);
        return null;
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called without associate access');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called without associate access');
      },
    },
  });

  await assert.rejects(() => getAssociateFinancialSummary({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
  }), (error) => {
    assert.ok(error instanceof NotFoundError);
    assert.equal(error.message, 'El socio no existe.');
    return true;
  });
});

test('createGetAssociateFinancialSummary reports current capital after capital returns and reinvestments', async () => {
  const getAssociateFinancialSummary = createGetAssociateFinancialSummary({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Socio Capital Vigente' };
      },
      async listContributionsByAssociate() {
        return [
          { id: 1, amount: 1000, status: 'completed' },
          { id: 2, amount: 200, status: 'completed', notes: 'Reinversión' },
          { id: 3, amount: 500, status: 'pending' },
        ];
      },
      async listProfitDistributionsByAssociate() {
        return [
          { id: 4, amount: 200, basis: { type: 'reinvestment', contributionId: 2 } },
          { id: 5, amount: 300, basis: { type: 'capital-return' } },
          { id: 6, amount: 50, basis: { type: 'manual-interest' } },
        ];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
    },
  });

  const report = await getAssociateFinancialSummary({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
  });

  assert.equal(report.summary.totalContributed, '1200.00');
  assert.equal(report.summary.totalCapitalReturned, '300.00');
  assert.equal(report.summary.currentCapital, '900.00');
});

test('createExportAssociateFinancialSummary returns xlsx workbook for associate datasets', async () => {
  let contributionReads = 0;
  let distributionReads = 0;
  const exportAssociateFinancialSummary = createExportAssociateFinancialSummary({
    reportRepository: {
      async getAssociateExportDataset() {
        return {
          associate: { id: 12 },
          contributions: [{ id: 1, amount: 1000, contributionDate: '2026-01-01' }],
          distributions: [{ id: 2, amount: 150, distributionDate: '2026-02-01', loanId: 5, basis: { type: 'manual-interest' } }],
          loans: [{ id: 5, amount: 4000, status: 'active', Customer: { name: 'Ana' } }],
        };
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One' };
      },
      async listContributionsByAssociate() {
        contributionReads += 1;
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        distributionReads += 1;
        return [{ id: 2, amount: 150, distributionType: 'manual' }];
      },
      async findInstallmentsByAssociateId() {
        return [
          {
            id: 3,
            installmentNumber: 1,
            amount: 200,
            dueDate: '2026-03-01',
            paidAt: '2026-03-02',
            status: 'paid',
            paymentMethod: 'transferencia',
            paidByUser: { name: 'Admin QA' },
          },
          {
            id: 4,
            installmentNumber: 2,
            amount: 250,
            dueDate: '2026-04-01',
            status: 'pending',
          },
        ];
      },
      async listLoansByAssociate() {
        return [{ id: 5, amount: 4000 }];
      },
    },
  });

  const exportFile = await exportAssociateFinancialSummary({ actor: { id: 1, role: 'admin' }, associateId: 12, format: 'xlsx' });

  assert.equal(exportFile.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(exportFile.buffer.subarray(0, 2).toString('utf8'), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportFile.buffer);
  const serializedWorkbookValues = JSON.stringify(workbook.worksheets.map((sheet) => sheet.getSheetValues()));
  assert.match(serializedWorkbookValues, /Pago manual de rentabilidad/);
  assert.equal(/proportional|Participaci[oó]n|Monto Asignado|Total Proporcional/i.test(serializedWorkbookValues), false);
  const manualPaymentsSheet = workbook.getWorksheet('Pagos manuales');
  assert.equal(manualPaymentsSheet.getRow(3).getCell(5).value, 'Pago manual de rentabilidad');
  const summarySheet = workbook.getWorksheet('Resumen General');
  const summaryHeaders = summarySheet.getRow(2).values;
  assert.equal(summaryHeaders.includes('Unidad'), false);
  let totalContributedRow = null;
  let currentCapitalRow = null;
  let nextPaymentRow = null;
  summarySheet.eachRow((row) => {
    if (row.getCell(1).value === 'Aportes Totales') {
      totalContributedRow = row;
    }
    if (row.getCell(1).value === 'Capital Vigente') {
      currentCapitalRow = row;
    }
    if (row.getCell(1).value === 'Próximo Pago') {
      nextPaymentRow = row;
    }
  });
  assert.equal(totalContributedRow?.getCell(2).value, 'COP 1.000,00');
  assert.equal(currentCapitalRow?.getCell(2).value, 'COP 1.000,00');
  assert.equal(nextPaymentRow?.getCell(2).value, '01/04/2026');
  assert.equal(workbook.getWorksheet('Aportes').getRow(3).getCell(2).value, 'COP 1.000,00');
  assert.equal(workbook.getWorksheet('Pagos manuales').getRow(3).getCell(3).value, 'COP 150,00');
  assert.equal(workbook.getWorksheet('Cronograma').getRow(3).getCell(2).value, 'COP 200,00');
  assert.equal(workbook.getWorksheet('Cronograma').getRow(4).getCell(2).value, 'COP 250,00');
  assert.match(serializedWorkbookValues, /Interés Pendiente/);
  assert.match(serializedWorkbookValues, /CRONOGRAMA/);
  assert.equal(contributionReads, 1);
  assert.equal(distributionReads, 1);
});

test('createExportAssociateFinancialSummary rejects socio export requests', async () => {
  const exportAssociateFinancialSummary = createExportAssociateFinancialSummary({
    reportRepository: {
      async getAssociateExportDataset() {
        throw new Error('getAssociateExportDataset should not be called');
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Other Partner' };
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async listLoansByAssociate() {
        throw new Error('listLoansByAssociate should not be called');
      },
    },
  });

  await assert.rejects(() => exportAssociateFinancialSummary({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 99,
    format: 'xlsx',
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden acceder al resumen financiero de socios.');
    return true;
  });
});

test('createExportAssociateFinancialSummary keeps csv exports focused on recorded associate movements', async () => {
  const exportAssociateFinancialSummary = createExportAssociateFinancialSummary({
    reportRepository: {
      async getAssociateExportDataset() {
        return {
          associate: { id: 12 },
          contributions: [],
          distributions: [{ id: 2, amount: 150, distributionDate: '2026-02-01', loanId: 5, basis: { type: 'manual-interest' } }],
          loans: [],
        };
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One' };
      },
      async listContributionsByAssociate() {
        return [];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150, basis: { type: 'manual-interest' } }];
      },
      async findInstallmentsByAssociateId() {
        return [
          {
            id: 3,
            installmentNumber: 1,
            amount: 200,
            dueDate: '2026-03-01',
            paidAt: '2026-03-02',
            status: 'paid',
          },
          {
            id: 4,
            installmentNumber: 2,
            amount: 250,
            dueDate: '2026-04-01',
            status: 'pending',
          },
        ];
      },
      async listLoansByAssociate() {
        return [];
      },
    },
  });

  const exportFile = await exportAssociateFinancialSummary({ actor: { id: 1, role: 'admin' }, associateId: 12, format: 'csv' });

  assert.equal(exportFile.fileName, 'associate-12-financial-summary.csv');
  assert.equal(exportFile.contentType, 'text/csv; charset=utf-8');
  assert.match(exportFile.buffer.toString('utf8'), /Sección,ID,Referencia,Monto,Fecha,Estado,Tipo de Movimiento,Notas/);
  assert.match(exportFile.buffer.toString('utf8'), /Pago manual de rentabilidad,2,,150,,,Pago manual de rentabilidad,/);
  assert.match(exportFile.buffer.toString('utf8'), /Cronograma de intereses,1,,200,2026-03-02,Pagado/);
  assert.match(exportFile.buffer.toString('utf8'), /Cronograma de intereses,2,,250,2026-04-01,Vencido/);
  assert.match(exportFile.buffer.toString('utf8'), /Cronograma de intereses,2,,250,2026-04-01,Vencido/);
});
