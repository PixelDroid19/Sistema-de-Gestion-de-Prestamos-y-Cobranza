const { test } = require('node:test');
const assert = require('node:assert/strict');

const { deriveLoanOverdueSnapshot } = require('@/modules/credits/application/useCases');

const ASOF = new Date('2026-06-15T00:00:00Z');

const buildLoan = (overrides = {}) => ({
  lateFeeMode: 'SIMPLE',
  annualLateFeeRate: 0,
  emiSchedule: [],
  ...overrides,
});

test('deriveLoanOverdueSnapshot flags a loan with a past-due unpaid installment as overdue', () => {
  const loan = buildLoan({
    emiSchedule: [
      // Past due, still owed -> overdue
      { installmentNumber: 1, dueDate: '2026-05-15', status: 'pending', remainingPrincipal: 100, remainingInterest: 10 },
      // Future, owed -> not overdue
      { installmentNumber: 2, dueDate: '2026-07-15', status: 'pending', remainingPrincipal: 100, remainingInterest: 10 },
    ],
  });

  const snapshot = deriveLoanOverdueSnapshot(loan, ASOF);

  assert.equal(snapshot.isOverdue, true);
  assert.equal(snapshot.overdueInstallments, 1);
  assert.equal(snapshot.overdueAmount, 110);
  assert.ok(snapshot.daysOverdue >= 30);
});

test('deriveLoanOverdueSnapshot ignores paid, annulled and settled installments', () => {
  const loan = buildLoan({
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-05-15', status: 'paid', remainingPrincipal: 0, remainingInterest: 0 },
      { installmentNumber: 2, dueDate: '2026-05-15', status: 'annulled', remainingPrincipal: 100, remainingInterest: 0 },
      // past due but fully settled (no outstanding) -> not overdue
      { installmentNumber: 3, dueDate: '2026-05-15', status: 'pending', remainingPrincipal: 0, remainingInterest: 0 },
    ],
  });

  const snapshot = deriveLoanOverdueSnapshot(loan, ASOF);

  assert.equal(snapshot.isOverdue, false);
  assert.equal(snapshot.overdueInstallments, 0);
  assert.equal(snapshot.overdueAmount, 0);
  assert.equal(snapshot.daysOverdue, 0);
});

test('deriveLoanOverdueSnapshot returns a clean snapshot when there is no schedule', () => {
  const snapshot = deriveLoanOverdueSnapshot(buildLoan(), ASOF);

  assert.deepEqual(snapshot, {
    isOverdue: false,
    daysOverdue: 0,
    overdueInstallments: 0,
    overdueAmount: 0,
    lateFeeOutstanding: 0,
  });
});
