const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repositoriesModulePath = path.resolve(__dirname, '../src/modules/reports/infrastructure/repositories.js');
const { reportRepository } = require(repositoriesModulePath);
const { Loan, Payment } = require('@/models');

const TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE = '"principalApplied" + "interestApplied" + "penaltyApplied"';

test('reportRepository financial aggregates quote mixed-case payment columns', async (t) => {
  const originalFindAll = Payment.findAll;
  const originalLoanFindAll = Loan.findAll;

  t.after(() => {
    Payment.findAll = originalFindAll;
    Loan.findAll = originalLoanFindAll;
  });

  const capturedPaymentQueries = [];
  Payment.findAll = async (query) => {
    capturedPaymentQueries.push(query);

    if (capturedPaymentQueries.length === 1) {
      return [{ month: '2026-01-01T00:00:00.000Z', totalEarnings: '438.81', paymentCount: '1' }];
    }

    if (capturedPaymentQueries.length === 2) {
      return [{ totalAmount: '438.81', count: '1' }];
    }

    return [{ totalInterest: '38.81', totalPenalties: '0.00' }];
  };

  Loan.findAll = async () => [{ totalLoans: '1', totalAmount: '2500.00' }];

  await reportRepository.getMonthlyEarnings(2026);
  await reportRepository.getPerformanceMetrics(2026);

  assert.equal(capturedPaymentQueries.length, 3);

  const [monthlyQuery, performanceQuery] = capturedPaymentQueries;

  assert.equal(monthlyQuery.attributes[1][0].fn, 'SUM');
  assert.equal(monthlyQuery.attributes[1][0].args[0].val, TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE);

  assert.equal(performanceQuery.attributes[0][0].fn, 'SUM');
  assert.equal(performanceQuery.attributes[0][0].args[0].val, TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE);
});
