const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRepairedSchedule,
} = require('../scripts/repairCapitalPaymentSchedules');

test('buildRepairedSchedule keeps the first rebuilt due date on the damaged installment date', () => {
  const schedule = [
    {
      installmentNumber: 1,
      dueDate: '2026-07-10T00:00:00.000Z',
      scheduledPayment: 225650.82,
      remainingPrincipal: 0,
      remainingInterest: 0,
      paidPrincipal: 125650.82,
      paidInterest: 100000,
      paidTotal: 225650.82,
      status: 'paid',
    },
    {
      installmentNumber: 2,
      dueDate: '2026-08-10T00:00:00.000Z',
      scheduledPayment: 225650.82,
      remainingPrincipal: 40000,
      remainingInterest: 25000,
      paidPrincipal: 100000,
      paidInterest: 0,
      paidTotal: 100000,
      status: 'partial',
    },
    {
      installmentNumber: 3,
      dueDate: '2026-09-10T00:00:00.000Z',
      scheduledPayment: 225650.82,
      remainingPrincipal: 120000,
      remainingInterest: 20000,
      paidPrincipal: 0,
      paidInterest: 0,
      paidTotal: 0,
      status: 'pending',
    },
  ];

  const repaired = buildRepairedSchedule({
    loan: {
      interestRate: 60,
      installmentAmount: 225650.82,
      calculationMethod: 'FRENCH',
    },
    schedule,
    firstAffectedIndex: 1,
    capitalReduction: 100000,
    strategy: 'reduce_payment',
  });

  assert.equal(repaired.schedule[1].installmentNumber, 2);
  assert.equal(repaired.schedule[1].dueDate, '2026-08-10T00:00:00.000Z');
});
