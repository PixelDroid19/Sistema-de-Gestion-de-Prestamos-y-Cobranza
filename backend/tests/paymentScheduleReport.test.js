const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createGetPaymentSchedule,
  summarizePaymentSchedule,
} = require('@/modules/reports/application/useCases/createGetPaymentSchedule');

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

test('payment schedule uses the shared loan access policy and completed report payments', async () => {
  const calls = [];
  const loan = {
    id: 77,
    customerId: 9,
    Customer: { name: 'Cliente Demo' },
    amount: 300000,
    interestRate: 12,
    termMonths: 2,
    startDate: '2026-01-01',
    status: 'active',
    installmentAmount: 160000,
    emiSchedule: [
      {
        installmentNumber: 1,
        scheduledPayment: 160000,
        principalComponent: 145000,
        interestComponent: 15000,
      },
      {
        installmentNumber: 2,
        scheduledPayment: 160000,
        principalComponent: 155000,
        interestComponent: 5000,
      },
    ],
  };

  const getPaymentSchedule = createGetPaymentSchedule({
    loanAccessPolicy: {
      async findAuthorizedLoan(input) {
        calls.push(['findAuthorizedLoan', input.actor.role, input.loanId]);
        return loan;
      },
    },
    paymentRepository: {
      async listByLoan(loanId) {
        calls.push(['listByLoan', loanId]);
        return [
          { installmentNumber: 1, amount: 160000, paymentDate: '2026-02-01', id: 100, status: 'completed', paymentType: 'installment' },
          { installmentNumber: 2, amount: 160000, paymentDate: '2026-03-01', id: 101, status: 'reversed', paymentType: 'installment' },
        ];
      },
    },
  });

  const result = await getPaymentSchedule({ actor: { id: 5, role: 'employee' }, loanId: 77 });

  assert.deepEqual(calls, [
    ['findAuthorizedLoan', 'employee', 77],
    ['listByLoan', 77],
  ]);
  assert.equal(result.data.loan.customerName, 'Cliente Demo');
  assert.equal(result.data.summary.paidInstallments, 1);
  assert.equal(result.data.summary.pendingInstallments, 1);
  assert.equal(result.data.schedule[0].status, 'paid');
  assert.equal(result.data.schedule[1].status, 'pending');
});
