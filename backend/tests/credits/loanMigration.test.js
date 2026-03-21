const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { migrateLoansToDefaultProduct } = require('../../src/scripts/migrateLoansToProducts');
const models = require('../../src/models');

beforeEach(() => {
  mock.restoreAll();
});

test('migrateLoansToDefaultProduct throws error when default product is missing', async () => {
  mock.method(models.FinancialProduct, 'findOne', async () => null);

  await assert.rejects(
    async () => migrateLoansToDefaultProduct(),
    { message: 'Product "Personal Loan 12%" not found. Run seed data first.' }
  );
});

test('migrateLoansToDefaultProduct returns migrated: 0 when no orphaned loans', async () => {
  const mockProduct = {
    id: 'prod-default',
    name: 'Personal Loan 12%',
  };

  mock.method(models.FinancialProduct, 'findOne', async () => mockProduct);
  mock.method(models.Loan, 'count', async () => 0);

  const result = await migrateLoansToDefaultProduct();

  assert.equal(result.migrated, 0);
});

test('migrateLoansToDefaultProduct migrates orphaned loans to the UUID default product', async () => {
  const mockProduct = {
    id: 'prod-default',
    name: 'Personal Loan 12%',
  };

  let transactionContext = null;
  let updateArgs = null;
  mock.method(models.FinancialProduct, 'findOne', async () => mockProduct);
  mock.method(models.Loan, 'count', async () => 3);
  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    transactionContext = { id: 'tx-migration' };
    return txHandler(transactionContext);
  });
  mock.method(models.Loan, 'update', async (values, options) => {
    updateArgs = { values, options };
    return [3];
  });

  const result = await migrateLoansToDefaultProduct();

  assert.equal(result.migrated, 3);
  assert.deepEqual(updateArgs.values, { financialProductId: 'prod-default' });
  assert.deepEqual(updateArgs.options.where, { financialProductId: null });
  assert.equal(updateArgs.options.transaction, transactionContext);
});

test('migrateLoansToDefaultProduct does not change already migrated loans', async () => {
  const mockProduct = {
    id: 'prod-default',
    name: 'Personal Loan 12%',
  };

  mock.method(models.FinancialProduct, 'findOne', async () => mockProduct);
  mock.method(models.Loan, 'count', async () => 0);
  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-check' });
  });

  const result = await migrateLoansToDefaultProduct();

  assert.equal(result.migrated, 0);
});
