'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of ['housingType', 'maritalStatus']) {
        await queryInterface.addColumn('Customers', column, {
          type: Sequelize.STRING,
          allowNull: true,
        }, { transaction });
      }
      await queryInterface.addColumn('Customers', 'dependentsCount', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });
      await queryInterface.sequelize.query(
        'ALTER TABLE "Customers" ADD CONSTRAINT "customers_dependents_nonnegative" CHECK ("dependentsCount" IS NULL OR "dependentsCount" >= 0);',
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TABLE "Customers" DROP CONSTRAINT IF EXISTS "customers_dependents_nonnegative";',
        { transaction },
      );
      for (const column of ['dependentsCount', 'maritalStatus', 'housingType']) {
        await queryInterface.removeColumn('Customers', column, { transaction });
      }
    });
  },
};
