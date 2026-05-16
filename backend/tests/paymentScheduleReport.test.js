const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizePaymentSchedule } = require('@/modules/reports/application/useCases/createGetPaymentSchedule');

test('payment schedule summary includes completed capital prepayments', () => {
  const summary = summarizePaymentSchedule({
    schedule: [
      {
        installmentNumber: 1,
        scheduledPayment: 138448.13,
        principalComponent: 115948.13,
        interestComponent: 22500,
      },
      {
        installmentNumber: 2,
        scheduledPayment: 138448.13,
        principalComponent: 120926.57,
        interestComponent: 17521.56,
      },
      {
        installmentNumber: 3,
        scheduledPayment: 80484.41,
        principalComponent: 78140.2,
        interestComponent: 2344.21,
      },
    ],
    payments: [
      {
        paymentType: 'installment',
        amount: 138448.13,
        principalApplied: 115948.13,
        interestApplied: 22500,
      },
      {
        paymentType: 'capital',
        amount: 50000,
        principalApplied: 50000,
        interestApplied: 0,
      },
    ],
  });

  assert.equal(summary.capitalPrepayments, 50000);
  assert.equal(Number(summary.totalPrincipal.toFixed(2)), 365014.9);
  assert.equal(Number(summary.totalInterest.toFixed(2)), 42365.77);
  assert.equal(Number(summary.totalPayment.toFixed(2)), 407380.67);
});
