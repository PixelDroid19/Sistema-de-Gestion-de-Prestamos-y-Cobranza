const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('@/utils/errorHandler');
const { createExportCreditsExcel, createExportCreditsPdf } = require('@/modules/reports/application/useCases/createExportCreditsExcel');
const { createExportPayoutsExcel, createExportPayoutsPdf } = require('@/modules/reports/application/useCases/createExportPayoutsExcel');
const { createGetComparativeAnalysis } = require('@/modules/reports/application/useCases/createGetComparativeAnalysis');
const { createGetComprehensiveAnalytics } = require('@/modules/reports/application/useCases/createGetComprehensiveAnalytics');
const { createGetCreditEarnings } = require('@/modules/reports/application/useCases/createGetCreditEarnings');
const { createGetDailyCashFlow, createGetMonthlyCashFlow } = require('@/modules/reports/application/useCases/createMonthlyCashFlowReport');
const { createGetExecutiveDashboard } = require('@/modules/reports/application/useCases/createGetExecutiveDashboard');
const { createGetForecastAnalysis } = require('@/modules/reports/application/useCases/createGetForecastAnalysis');
const { createGetInterestEarnings } = require('@/modules/reports/application/useCases/createGetInterestEarnings');
const { createGetMonthlyEarnings } = require('@/modules/reports/application/useCases/createGetMonthlyEarnings');
const { createGetMonthlyInterest } = require('@/modules/reports/application/useCases/createGetMonthlyInterest');
const { createGetNextMonthProjection } = require('@/modules/reports/application/useCases/createGetNextMonthProjection');
const { createGetPayoutsReport } = require('@/modules/reports/application/useCases/createGetPayoutsReport');
const { createGetPerformanceAnalysis } = require('@/modules/reports/application/useCases/createGetPerformanceAnalysis');

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

test('financial analytics report use cases reject unsupported actors with Spanish messages', async () => {
  const expectedMessage = 'Solo usuarios administrativos autorizados pueden acceder a reportes financieros.';
  const cases = [
    ['comparative analysis', createGetComparativeAnalysis({ reportRepository })],
    ['performance analysis', createGetPerformanceAnalysis({ reportRepository })],
    ['next month projection', createGetNextMonthProjection({ reportRepository })],
    ['forecast analysis', createGetForecastAnalysis({ reportRepository })],
    ['executive dashboard', createGetExecutiveDashboard({ reportRepository, paymentRepository })],
    ['comprehensive analytics', createGetComprehensiveAnalytics({ reportRepository, paymentRepository })],
    ['credit earnings', createGetCreditEarnings({ reportRepository })],
    ['interest earnings', createGetInterestEarnings({ paymentRepository })],
    ['monthly earnings', createGetMonthlyEarnings({ reportRepository })],
    ['monthly interest', createGetMonthlyInterest({ paymentRepository })],
  ];

  for (const [name, useCase] of cases) {
    await assertAuthorizationMessage({ name, useCase, expectedMessage });
  }
});

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
      name: 'credits PDF export',
      useCase: createExportCreditsPdf({ reportRepository, paymentRepository, loanViewService }),
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
      expectedMessage: 'Solo usuarios administrativos autorizados pueden acceder al flujo de caja mensual.',
    },
    {
      name: 'daily cash flow',
      useCase: createGetDailyCashFlow({ reportRepository }),
      expectedMessage: 'Solo usuarios administrativos autorizados pueden acceder al flujo de caja diario.',
    },
  ];

  for (const testCase of cases) {
    await assertAuthorizationMessage(testCase);
  }
});
