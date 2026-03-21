const { sequelize, Loan, FinancialProduct } = require('../models');

const DEFAULT_FINANCIAL_PRODUCT_NAME = 'Personal Loan 12%';

async function migrateLoansToDefaultProduct() {
  const defaultProduct = await FinancialProduct.findOne({
    where: { name: DEFAULT_FINANCIAL_PRODUCT_NAME },
  });

  if (!defaultProduct) {
    throw new Error(`Product \"${DEFAULT_FINANCIAL_PRODUCT_NAME}\" not found. Run seed data first.`);
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
      }
    );

    return { migrated };
  });

  console.log(`Migrated ${result.migrated} loans to Product "${defaultProduct.name}" (${defaultProduct.id})`);
  return result;
}

if (require.main === module) {
  migrateLoansToDefaultProduct()
    .then(r => { console.log('Migration complete:', r); process.exit(0); })
    .catch(e => { console.error('Migration failed:', e); process.exit(1); });
}

module.exports = { migrateLoansToDefaultProduct, DEFAULT_FINANCIAL_PRODUCT_NAME };
