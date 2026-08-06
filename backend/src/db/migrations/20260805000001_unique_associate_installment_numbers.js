'use strict';

/**
 * Prevent concurrent projections from creating two rows for the same scheduled
 * interest installment. Existing duplicates are invalid state; keep one row per
 * associate/number, preferring a paid row so historical payment evidence wins.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY "associateId", "installmentNumber"
              ORDER BY CASE WHEN status = 'paid' THEN 0 ELSE 1 END, id
            ) AS row_number
          FROM "AssociateInstallments"
        )
        DELETE FROM "AssociateInstallments"
        WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);
      `, { transaction });

      await queryInterface.addIndex(
        'AssociateInstallments',
        ['associateId', 'installmentNumber'],
        {
          unique: true,
          name: 'associate_installments_associate_number_unique',
          transaction,
        },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'AssociateInstallments',
      'associate_installments_associate_number_unique',
    );
  },
};
