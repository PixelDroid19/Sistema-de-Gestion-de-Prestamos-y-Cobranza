'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('Loans', 'calculationMethod', {
        type: DataTypes.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('Loans', 'ratePolicyId', {
        type: DataTypes.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('Loans', 'lateFeePolicyId', {
        type: DataTypes.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('Loans', 'policySnapshot', {
        type: DataTypes.JSONB,
        allowNull: true,
      }, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('Loans', 'policySnapshot', { transaction });
      await queryInterface.removeColumn('Loans', 'lateFeePolicyId', { transaction });
      await queryInterface.removeColumn('Loans', 'ratePolicyId', { transaction });
      await queryInterface.removeColumn('Loans', 'calculationMethod', { transaction });
    });
  },
};
