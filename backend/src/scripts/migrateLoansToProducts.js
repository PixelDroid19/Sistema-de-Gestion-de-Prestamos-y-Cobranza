require('module-alias/register');
require('dotenv').config({ quiet: true });

const { sequelize, Loan, FinancialProduct } = require('@/models');

const DEFAULT_FINANCIAL_PRODUCT_NAME = 'Personal Loan 12%';
const CONFIRMATION_VALUE = 'MIGRATE_LOANS_TO_PRODUCTS';

function assertConfirmed(env = process.env) {
  if (env.MIGRATE_LOANS_TO_PRODUCTS_CONFIRM !== CONFIRMATION_VALUE) {
    throw new Error(`Refusing to migrate loans. Set MIGRATE_LOANS_TO_PRODUCTS_CONFIRM=${CONFIRMATION_VALUE}`);
  }
}

async function migrateLoansToDefaultProduct() {
  const defaultProduct = await FinancialProduct.findOne({
    where: { name: DEFAULT_FINANCIAL_PRODUCT_NAME },
  });

  if (!defaultProduct) {
    throw new Error(`Product "${DEFAULT_FINANCIAL_PRODUCT_NAME}" not found. Run seed data first.`);
  }

  const orphanedCount = await Loan.count({
    where: { financialProductId: null },
  });

  if (orphanedCount === 0) {
    console.log('No orphaned loans to migrate');
    return { migrated: 0 };
  }

  const result = await sequelize.transaction(async (tx) => {
    const [migrated] = await Loan.update(
      {
        financialProductId: defaultProduct.id,
      },
      {
        where: { financialProductId: null },
        transaction: tx,
      },
    );

    return { migrated };
  });

  console.log(`Migrated ${result.migrated} loans to Product "${defaultProduct.name}" (${defaultProduct.id})`);
  return result;
}

async function main() {
  assertConfirmed();
  const result = await migrateLoansToDefaultProduct();
  console.log('Migration complete:', result);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  CONFIRMATION_VALUE,
  DEFAULT_FINANCIAL_PRODUCT_NAME,
  assertConfirmed,
  main,
  migrateLoansToDefaultProduct,
};
