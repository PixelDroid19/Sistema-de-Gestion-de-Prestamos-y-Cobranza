'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('Payments', 'createdByUserId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }, { transaction });

      await queryInterface.addIndex('Payments', ['createdByUserId'], {
        name: 'payments_created_by_user_id',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('Payments', 'payments_created_by_user_id', { transaction });
      await queryInterface.removeColumn('Payments', 'createdByUserId', { transaction });
    });
  },
};
