const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('@/utils/errorHandler');
const { createExportCreditsExcel } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
const { createExportPayoutsExcel, createExportPayoutsPdf } = require('@/modules/reports/application/useCases/createExportPayoutsExcel');
const { createGetMonthlyCashFlow } = require('@/modules/reports/application/useCases/createMonthlyCashFlowReport');
const { createGetPayoutsReport } = require('@/modules/reports/application/useCases/createGetPayoutsReport');

const unauthorizedActor = { id: 99, role: 'customer' };
const reportRepository = {};
const paymentRepository = {};
const loanViewService = {};

const assertAuthorizationMessage = async ({ name, useCase, expectedMessage }) => {
  await assert.rejects(
    () => useCase({ actor: unauthorizedActor, year: 2026 }),
    (error) => {
      assert.ok(error instanceof AuthorizationError, name);
      assert.equal(error.message, expectedMessage, name);
      return true;
    },
  );
};

test('specialized report use cases reject unsupported actors with Spanish messages', async () => {
  const cases = [
    {
      name: 'payouts report',
      useCase: createGetPayoutsReport({ reportRepository, paymentRepository }),
      expectedMessage: 'Solo usuarios administrativos autorizados pueden acceder al reporte de pagos.',
    },
    {
      name: 'credits Excel export',
      useCase: createExportCreditsExcel({ reportRepository, paymentRepository, loanViewService }),
      expectedMessage: 'Solo usuarios administrativos autorizados pueden exportar datos de créditos.',
    },
    {
      name: 'payouts Excel export',
      useCase: createExportPayoutsExcel({ paymentRepository }),
      expectedMessage: 'Solo usuarios administrativos autorizados pueden exportar datos de pagos.',
    },
    {
      name: 'payouts PDF export',
      useCase: createExportPayoutsPdf({ paymentRepository }),
      expectedMessage: 'Solo usuarios administrativos autorizados pueden exportar datos de pagos.',
    },
    {
      name: 'monthly cash flow',
      useCase: createGetMonthlyCashFlow({ reportRepository }),
      expectedMessage: 'Solo usuarios administrativos autorizados pueden acceder al cierre contable mensual.',
    },
  ];

  for (const testCase of cases) {
    await assertAuthorizationMessage(testCase);
  }
});
