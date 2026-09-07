const assert = require('node:assert/strict');

module.exports = async ({ expectStatus, token, customerId, fixturePrefix, fixtureLoanIds, Loan }) => {
  const created = await expectStatus({
    method: 'POST', path: '/api/loans', token,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-calendar-loan` },
    body: { customerId, amount: 1000000, termMonths: 3, startDate: '2026-01-31', rateSource: 'policy', lateFeeSource: 'policy' },
  }, 201);
  const loan = created.body.data.loan;
  fixtureLoanIds.push(loan.id);
  await expectStatus({
    method: 'POST', path: '/api/loans/payments/process', token,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-calendar-installment` },
    body: { loanId: loan.id, paymentAmount: Number(loan.emiSchedule[0].scheduledPayment), paymentDate: '2026-02-28', paymentMethod: 'cash' },
  }, 200);
  await expectStatus({
    method: 'POST', path: '/api/payments/capital', token,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-calendar-prepayment` },
    body: { loanId: loan.id, amount: 200000, paymentDate: '2026-02-28', paymentMethod: 'cash', strategy: 'REDUCE_QUOTA', newTermMonths: 4 },
  }, 201);
  const persisted = await Loan.findByPk(loan.id);
  assert.deepEqual(persisted.emiSchedule.map((row) => row.dueDate.slice(0, 10)),
    ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'],
    'El abono debe conservar las fechas pactadas y el día de corte al extender el plazo.');
};
