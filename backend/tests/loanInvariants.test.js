const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertConsistentClosureState,
  assertEndDateNotBeforeStartDate,
} = require('@/modules/credits/domain/loanInvariants');

test('loan invariants report invalid end dates in Spanish', () => {
  assert.throws(
    () => assertEndDateNotBeforeStartDate({
      startDate: '2026-02-01',
      endDate: '2026-01-31',
    }),
    /La fecha final del crédito debe ser igual o posterior a la fecha de inicio/,
  );
});

test('loan invariants report inconsistent closure state in Spanish', () => {
  assert.throws(
    () => assertConsistentClosureState({
      status: 'active',
      closureReason: 'payoff',
      closedAt: null,
    }),
    /El motivo de cierre requiere que el crédito esté cerrado, cancelado o pagado/,
  );

  assert.throws(
    () => assertConsistentClosureState({
      status: 'closed',
      closureReason: null,
      closedAt: null,
    }),
    /Los créditos cerrados, cancelados o pagados deben tener fecha de cierre/,
  );
});
