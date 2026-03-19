const test = require('node:test');
const assert = require('node:assert/strict');

const { ValidationError } = require('../src/utils/errorHandler');
const { createRecoveryStatusGuard } = require('../src/modules/credits/application/recoveryStatusGuard');

const createGuard = (outstandingBalance) => createRecoveryStatusGuard({
  loanViewService: {
    getSnapshot() {
      return { outstandingBalance };
    },
  },
});

test('createRecoveryStatusGuard rejects non-defaulted loans', () => {
  const guard = createGuard(250);

  assert.throws(() => guard.assertCanTransition({
    loan: { status: 'approved', recoveryStatus: 'pending' },
    nextRecoveryStatus: 'contacted',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Recovery status can only be updated for defaulted loans');
    return true;
  });
});

test('createRecoveryStatusGuard rejects closed and already recovered loans', () => {
  const closedGuard = createGuard(0);

  assert.throws(() => closedGuard.assertCanTransition({
    loan: { status: 'closed', recoveryStatus: 'recovered' },
    nextRecoveryStatus: 'failed',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Cannot modify recovery status for a closed loan');
    return true;
  });
});

test('createRecoveryStatusGuard rejects recovered transitions while balance remains', () => {
  const guard = createGuard(125);

  assert.throws(() => guard.assertCanTransition({
    loan: { status: 'defaulted', recoveryStatus: 'in_progress' },
    nextRecoveryStatus: 'recovered',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Cannot mark a loan as recovered while an outstanding balance remains');
    return true;
  });
});

test('createRecoveryStatusGuard allows valid defaulted-loan transitions with balance remaining', () => {
  const guard = createGuard(125);

  assert.doesNotThrow(() => guard.assertCanTransition({
    loan: { status: 'defaulted', recoveryStatus: 'assigned' },
    nextRecoveryStatus: 'contacted',
  }));
});
