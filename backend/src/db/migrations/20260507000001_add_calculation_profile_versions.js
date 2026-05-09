'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('CalculationProfileVersions', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        scopeKey: { type: DataTypes.STRING(120), allowNull: false },
        name: { type: DataTypes.STRING(255), allowNull: false },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
        calculationMethod: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'FRENCH' },
        parameters: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        formulaSet: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        changelog: { type: DataTypes.STRING(1000), allowNull: true },
        createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });

      await queryInterface.addIndex('CalculationProfileVersions', ['scopeKey', 'version'], {
        unique: true,
        name: 'calculation_profile_versions_scope_version_unique',
        transaction,
      });

      await queryInterface.addIndex('CalculationProfileVersions', ['scopeKey', 'status'], {
        unique: true,
        where: { status: 'active' },
        name: 'calculation_profile_versions_scope_active_unique',
        transaction,
      });

      await queryInterface.addColumn('Loans', 'calculationProfileVersionId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CalculationProfileVersions', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }, { transaction });

      await queryInterface.addIndex('Loans', ['calculationProfileVersionId'], {
        name: 'loans_calculation_profile_version_id',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('Loans', 'loans_calculation_profile_version_id', { transaction });
      await queryInterface.removeColumn('Loans', 'calculationProfileVersionId', { transaction });
      await queryInterface.dropTable('CalculationProfileVersions', { transaction });
    });
  },
};
