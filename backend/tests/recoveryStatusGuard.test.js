const test = require('node:test');
const assert = require('node:assert/strict');

const { ValidationError } = require('@/utils/errorHandler');
const { createRecoveryStatusGuard } = require('@/modules/credits/application/recoveryStatusGuard');

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
    assert.equal(error.message, 'Solo se puede actualizar la recuperación de créditos en incumplimiento.');
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
    assert.equal(error.message, 'No se puede modificar la recuperación de un crédito cerrado.');
    return true;
  });

  assert.throws(() => closedGuard.assertCanTransition({
    loan: { status: 'defaulted', recoveryStatus: 'recovered' },
    nextRecoveryStatus: 'failed',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'No se puede modificar la recuperación de un crédito ya recuperado.');
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
    assert.equal(error.message, 'No se puede marcar el crédito como recuperado mientras tenga saldo pendiente.');
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
