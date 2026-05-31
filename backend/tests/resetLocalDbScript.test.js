const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NONLOCAL_CONFIRMATION_VALUE,
  assertLocalDatabaseTarget,
} = require('../scripts/resetLocalDb');

test('resetLocalDb allows only local database hosts by default', () => {
  assert.doesNotThrow(() => assertLocalDatabaseTarget({ DB_HOST: 'localhost' }));
  assert.doesNotThrow(() => assertLocalDatabaseTarget({ DB_HOST: '127.0.0.1' }));
  assert.doesNotThrow(() => assertLocalDatabaseTarget({ DB_HOST: '::1' }));

  assert.throws(
    () => assertLocalDatabaseTarget({ DB_HOST: 'postgres.internal' }),
    /Refusing to reset non-local database host "postgres.internal"/,
  );
});

test('resetLocalDb requires explicit opt-in and confirmation for non-local hosts', () => {
  assert.throws(
    () => assertLocalDatabaseTarget({
      DB_HOST: 'postgres.internal',
      RESET_LOCAL_DB_ALLOW_NONLOCAL: 'true',
    }),
    /RESET_LOCAL_DB_CONFIRM=RESET_LOCAL_DB_NONLOCAL/,
  );

  assert.doesNotThrow(() => assertLocalDatabaseTarget({
    DB_HOST: 'postgres.internal',
    RESET_LOCAL_DB_ALLOW_NONLOCAL: 'true',
    RESET_LOCAL_DB_CONFIRM: NONLOCAL_CONFIRMATION_VALUE,
  }));
});
