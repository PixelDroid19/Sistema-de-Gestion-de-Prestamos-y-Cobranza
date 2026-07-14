require('module-alias/register');

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CONFIRMATION_VALUE,
  assertConfirmed,
  buildSeedConfig,
} = require('../scripts/resetProductionEmptyDataset');

const withEnvironment = async (overrides, run) => {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('empty production reset requires an explicit destructive confirmation', async () => {
  await withEnvironment({ RESET_PRODUCTION_EMPTY_DATASET_CONFIRM: undefined }, () => {
    assert.throws(() => assertConfirmed(), /Refusing to reset database/);
  });

  await withEnvironment({ RESET_PRODUCTION_EMPTY_DATASET_CONFIRM: CONFIRMATION_VALUE }, () => {
    assert.doesNotThrow(() => assertConfirmed());
  });
});

test('empty production reset seeds only the two administrative QA accounts', async () => {
  await withEnvironment({
    QA_PASSWORD: 'test-password',
    QA_ADMIN_EMAIL: 'qa.admin.20260519@test.local',
    QA_EMPLOYEE_EMAIL: 'qa.employee.20260519@test.local',
  }, () => {
    const config = buildSeedConfig();

    assert.deepEqual(config.users, [
      { name: 'QA Admin', email: 'qa.admin.20260519@test.local', role: 'admin' },
      { name: 'QA Employee', email: 'qa.employee.20260519@test.local', role: 'employee' },
    ]);
    assert.equal(config.password, 'test-password');
    assert.equal(Object.hasOwn(config, 'customer'), false);
    assert.equal(Object.hasOwn(config, 'associate'), false);
  });
});
