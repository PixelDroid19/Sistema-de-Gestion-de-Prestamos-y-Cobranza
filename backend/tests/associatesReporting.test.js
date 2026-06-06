const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const { AuthorizationError } = require('@/utils/errorHandler');
const {
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
} = require('@/modules/associates/application/reportingUseCases');

test('createGetAssociateProfitabilityReport rejects socio records as report users', async () => {
  const getAssociateProfitabilityReport = createGetAssociateProfitabilityReport({
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

  await assert.rejects(() => getAssociateProfitabilityReport({
    actor: { id: 9, role: 'socio', associateId: 12 },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden acceder a reportes de rentabilidad.');
    return true;
  });
});

test('createGetAssociateProfitabilityReport rejects socio records before associate lookup', async () => {
  const getAssociateProfitabilityReport = createGetAssociateProfitabilityReport({
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

  await assert.rejects(() => getAssociateProfitabilityReport({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 99,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden acceder a reportes de rentabilidad.');
    return true;
  });
});

test('createGetAssociateProfitabilityReport rejects missing associate access with an operator message', async () => {
  const getAssociateProfitabilityReport = createGetAssociateProfitabilityReport({
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

  await assert.rejects(() => getAssociateProfitabilityReport({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'El acceso a la rentabilidad del socio no está configurado para este usuario.');
    return true;
  });
});

test('createExportAssociateProfitabilityReport returns xlsx workbook for associate datasets', async () => {
  const exportAssociateProfitabilityReport = createExportAssociateProfitabilityReport({
    reportRepository: {
      async getAssociateExportDataset() {
        return {
          associate: { id: 12, participationPercentage: '25.0000' },
          contributions: [{ id: 1, amount: 1000, contributionDate: '2026-01-01' }],
          distributions: [{ id: 2, amount: 150, distributionDate: '2026-02-01', loanId: 5, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }],
          loans: [{ id: 5, amount: 4000, status: 'active', Customer: { name: 'Ana' } }],
        };
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150 }];
      },
      async listLoansByAssociate() {
        return [{ id: 5, amount: 4000 }];
      },
    },
  });

  const exportFile = await exportAssociateProfitabilityReport({ actor: { id: 1, role: 'admin' }, associateId: 12, format: 'xlsx' });

  assert.equal(exportFile.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(exportFile.buffer.subarray(0, 2).toString('utf8'), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportFile.buffer);
  const serializedWorkbookValues = JSON.stringify(workbook.worksheets.map((sheet) => sheet.getSheetValues()));
  assert.match(serializedWorkbookValues, /Proporcional/);
  assert.doesNotMatch(serializedWorkbookValues, /proportional|distributionType|proportional-participation/);
});

test('createExportAssociateProfitabilityReport rejects socio export requests', async () => {
  const exportAssociateProfitabilityReport = createExportAssociateProfitabilityReport({
    reportRepository: {
      async getAssociateExportDataset() {
        throw new Error('getAssociateExportDataset should not be called');
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Other Partner', participationPercentage: '75.0000' };
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

  await assert.rejects(() => exportAssociateProfitabilityReport({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 99,
    format: 'xlsx',
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden acceder a reportes de rentabilidad.');
    return true;
  });
});

test('createExportAssociateProfitabilityReport includes proportional audit columns in csv exports', async () => {
  const exportAssociateProfitabilityReport = createExportAssociateProfitabilityReport({
    reportRepository: {
      async getAssociateExportDataset() {
        return {
          associate: { id: 12, participationPercentage: '25.0000' },
          contributions: [],
          distributions: [{ id: 2, amount: 150, distributionDate: '2026-02-01', loanId: 5, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }],
          loans: [],
        };
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        return [];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }];
      },
      async listLoansByAssociate() {
        return [];
      },
    },
  });

  const exportFile = await exportAssociateProfitabilityReport({ actor: { id: 1, role: 'admin' }, associateId: 12, format: 'csv' });

  assert.equal(exportFile.contentType, 'text/csv; charset=utf-8');
  assert.match(exportFile.buffer.toString('utf8'), /Participación %,Tipo Distribución,Total Proporcional,Monto Asignado/);
  assert.match(exportFile.buffer.toString('utf8'), /25.0000,Proporcional,600.00,150.00/);
  assert.doesNotMatch(
    exportFile.buffer.toString('utf8'),
    /participationPercentage|distributionType|declaredProportionalTotal|allocatedAmount|proportional-participation/,
  );
});
