'use strict';

/**
 * Persist the fixed term agreed for new associate investments. The fields stay
 * nullable so historical associate records remain intact and continue using
 * their existing rolling-payment behavior.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Associates', 'investmentTermMonths', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Associates', 'investmentMaturityDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE "Associates" ADD CONSTRAINT "associates_investment_term_months_range" CHECK ("investmentTermMonths" IS NULL OR "investmentTermMonths" BETWEEN 1 AND 120);',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Associates" DROP CONSTRAINT IF EXISTS "associates_investment_term_months_range";',
    );
    await queryInterface.removeColumn('Associates', 'investmentMaturityDate');
    await queryInterface.removeColumn('Associates', 'investmentTermMonths');
  },
};
